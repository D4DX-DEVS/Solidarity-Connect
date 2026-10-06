import express from 'express';
import MonthlyReport from '../models/MonthlyReport.js';
import ReportForm from '../models/ReportForm.js';
import ReportFormVersion from '../models/ReportFormVersion.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { REPORT_LEVELS, normaliseFormFields, sumColumns } from '../services/monthlyReports/fields.js';
import { validateAnswers, changedFieldIds } from '../services/monthlyReports/answers.js';
import { parsePeriod, editState, currentPeriod } from '../services/monthlyReports/period.js';
import { consolidate } from '../services/monthlyReports/consolidate.js';
import {
  ensureForms, publishedForm, reportScopeFor, scopeCovers, isAllowedFileUrl,
} from '../services/monthlyReports/store.js';

// Monthly reports. Each month the state, every district and every area submits one
// shared report on a form the state admin designs; numbers add up the hierarchy.
const router = express.Router();

const UNLOCK_DAYS = 7;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const PEOPLE = 'name role';

router.use(authenticate, requireRole(['state_admin', 'district_admin', 'group_admin']));

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

const withPeople = (query) => query
  .populate('submittedBy', PEOPLE)
  .populate('lastEditedBy', PEOPLE)
  .populate('unlockedBy', PEOPLE)
  .populate('history.by', PEOPLE);

function formSummary(form) {
  return {
    level: form.level,
    title: form.title,
    fields: form.fields,
    nextFieldId: form.nextFieldId,
    version: form.version,
    hasUnpublishedChanges: form.hasUnpublishedChanges,
    deadlineDay: form.deadlineDay,
    publishedAt: form.publishedAt || null,
    updatedAt: form.updatedAt,
  };
}

function reportView(report) {
  if (!report) return null;
  return {
    id: String(report._id),
    level: report.level,
    year: report.year,
    month: report.month,
    formVersion: report.formVersion || null,
    answers: report.answers || {},
    submitted: Boolean(report.submittedAt),
    submittedBy: report.submittedBy || null,
    submittedAt: report.submittedAt || null,
    lastEditedBy: report.lastEditedBy || null,
    lastEditedAt: report.lastEditedAt || null,
    history: report.history || [],
    unlockedUntil: report.unlockedUntil || null,
    unlockedBy: report.unlockedBy || null,
    updatedAt: report.updatedAt,
  };
}

async function scopeOrFail(req, res) {
  const scope = await reportScopeFor(req.user);
  if (!scope) fail(res, 403, 'Your account is not linked to a district or area');
  return scope;
}

// ───────────────────────────── Form setup (state admin) ─────────────────────────────

// @route GET /api/monthly-reports/forms — all three level forms with draft + version info
router.get('/forms', requireRole(['state_admin']), async (req, res) => {
  try {
    await ensureForms();
    const forms = await ReportForm.find().lean();
    res.json({ success: true, data: REPORT_LEVELS.map(level => formSummary(forms.find(f => f.level === level))) });
  } catch (error) {
    console.error('Report forms error:', error);
    fail(res, 500, 'Failed to load report forms');
  }
});

// @route PUT /api/monthly-reports/forms/:level — save the draft (fields, title, deadline day)
router.put('/forms/:level', requireRole(['state_admin']), async (req, res) => {
  try {
    const { level } = req.params;
    if (!REPORT_LEVELS.includes(level)) return fail(res, 400, 'Unknown report level');
    await ensureForms();
    const form = await ReportForm.findOne({ level });

    // Two state admins editing at once: the second save must not silently drop the first.
    if (req.body?.updatedAt && new Date(req.body.updatedAt).getTime() !== form.updatedAt.getTime()) {
      return fail(res, 409, 'This form was changed by someone else. Reload to see the latest version.');
    }

    const { fields, nextFieldId, error } = normaliseFormFields(req.body?.fields, {
      savedIds: form.fields.map(f => f.id),
      nextFieldId: form.nextFieldId,
    });
    if (error) return fail(res, 400, error);

    if (req.body?.deadlineDay !== undefined) {
      const day = Number(req.body.deadlineDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) return fail(res, 400, 'Deadline day must be 1–28');
      form.deadlineDay = day;
    }
    if (req.body?.title !== undefined) {
      if (typeof req.body.title !== 'string') return fail(res, 400, 'Title must be text');
      form.title = req.body.title.trim().slice(0, 200);
    }

    form.fields = fields;
    form.markModified('fields');
    form.nextFieldId = nextFieldId;
    form.hasUnpublishedChanges = true;
    form.updatedBy = req.user._id;
    await form.save();
    res.json({ success: true, message: 'Draft saved', data: formSummary(form.toObject()) });
  } catch (error) {
    console.error('Save report form error:', error);
    fail(res, 500, 'Failed to save the form');
  }
});

// @route POST /api/monthly-reports/forms/:level/publish — freeze the draft as a new version
router.post('/forms/:level/publish', requireRole(['state_admin']), async (req, res) => {
  try {
    const { level } = req.params;
    if (!REPORT_LEVELS.includes(level)) return fail(res, 400, 'Unknown report level');
    await ensureForms();
    const form = await ReportForm.findOne({ level });
    if (!form.fields.some(f => f.type !== 'heading')) return fail(res, 400, 'Add at least one question before publishing');

    const version = form.version + 1;
    try {
      await ReportFormVersion.create({ level, version, title: form.title, fields: form.fields, publishedBy: req.user._id });
    } catch (error) {
      if (error?.code === 11000) return fail(res, 409, 'This form was just published by someone else. Reload.');
      throw error;
    }
    form.version = version;
    form.publishedAt = new Date();
    form.publishedBy = req.user._id;
    form.hasUnpublishedChanges = false;
    await form.save();
    res.json({ success: true, message: `Published version ${version}`, data: formSummary(form.toObject()) });
  } catch (error) {
    console.error('Publish report form error:', error);
    fail(res, 500, 'Failed to publish the form');
  }
});

// ───────────────────────────── The caller's own report ─────────────────────────────

// @route GET /api/monthly-reports/mine?year&month — own scope's report, its form and lock state
router.get('/mine', async (req, res) => {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return fail(res, 400, period.error);
    const scope = await scopeOrFail(req, res);
    if (!scope) return;
    await ensureForms();

    const [form, report] = await Promise.all([
      ReportForm.findOne({ level: scope.level }).lean(),
      withPeople(MonthlyReport.findOne({ scopeKey: scope.scopeKey, year: period.year, month: period.month })).lean(),
    ]);
    const version = report?.submittedAt ? report.formVersion : form.version;
    const published = await publishedForm(scope.level, version);
    const state = editState({ ...period, deadlineDay: form.deadlineDay, unlockedUntil: report?.unlockedUntil });

    res.json({
      success: true,
      data: {
        level: scope.level,
        scopeLabel: scope.label,
        period,
        canFill: scope.canFill,
        canEdit: scope.canFill && !state.locked && Boolean(published),
        locked: state.locked,
        future: state.future,
        deadline: state.deadline,
        editableUntil: state.editableUntil,
        form: published ? { version: published.version, title: published.title, fields: published.fields } : null,
        report: reportView(report),
      },
    });
  } catch (error) {
    console.error('Get my report error:', error);
    fail(res, 500, 'Failed to load the report');
  }
});

// @route PUT /api/monthly-reports/mine?year&month — submit or edit the shared report
router.put('/mine', async (req, res) => {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return fail(res, 400, period.error);
    const scope = await scopeOrFail(req, res);
    if (!scope) return;
    if (!scope.canFill) return fail(res, 403, 'You can view this report but not fill it');
    await ensureForms();

    const form = await ReportForm.findOne({ level: scope.level }).lean();
    const existing = await MonthlyReport.findOne({ scopeKey: scope.scopeKey, ...period });
    const state = editState({ ...period, deadlineDay: form.deadlineDay, unlockedUntil: existing?.unlockedUntil });
    if (state.future) return fail(res, 400, 'You cannot report a month that has not started');
    if (state.locked) return fail(res, 423, 'This month is locked. Ask a higher level to unlock it.');

    const submitted = Boolean(existing?.submittedAt);
    if (submitted && req.body?.updatedAt && new Date(req.body.updatedAt).getTime() !== existing.updatedAt.getTime()) {
      return fail(res, 409, 'Another admin saved this report while you were editing. Reload to see their changes.');
    }

    const version = submitted ? existing.formVersion : form.version;
    const published = await publishedForm(scope.level, version);
    if (!published) return fail(res, 400, 'The report form has not been published yet');

    const { answers, numbers, errors } = validateAnswers(published.fields, req.body?.answers, { isAllowedFileUrl });
    if (errors.length > 0) return fail(res, 400, errors[0].message, { errors });

    const now = new Date();
    if (!submitted) {
      const doc = existing || new MonthlyReport({
        level: scope.level, ...period, scopeKey: scope.scopeKey,
        district: scope.district || undefined, area: scope.area || undefined,
      });
      doc.formVersion = version;
      doc.answers = answers;
      doc.markModified('answers');
      doc.numbers = numbers;
      doc.submittedBy = req.user._id;
      doc.submittedAt = now;
      doc.history.push({ by: req.user._id, at: now, action: 'submitted', changed: changedFieldIds({}, answers) });
      try {
        await doc.save();
      } catch (error) {
        if (error?.code === 11000) return fail(res, 409, 'Another admin just submitted this report. Reload to see it.');
        throw error;
      }
    } else {
      const changed = changedFieldIds(existing.answers, answers);
      if (changed.length > 0) {
        existing.answers = answers;
        existing.markModified('answers');
        existing.numbers = numbers;
        existing.lastEditedBy = req.user._id;
        existing.lastEditedAt = now;
        existing.history.push({ by: req.user._id, at: now, action: 'edited', changed });
        await existing.save();
      }
    }

    const saved = await withPeople(MonthlyReport.findOne({ scopeKey: scope.scopeKey, ...period })).lean();
    res.json({ success: true, message: submitted ? 'Report updated' : 'Report submitted', data: reportView(saved) });
  } catch (error) {
    console.error('Save my report error:', error);
    fail(res, 500, 'Failed to save the report');
  }
});

// @route GET /api/monthly-reports/status?year — which months of a year the caller's scope submitted
router.get('/status', async (req, res) => {
  try {
    const period = parsePeriod({ year: req.query.year, month: '1' });
    if (period.error) return fail(res, 400, period.error);
    const scope = await scopeOrFail(req, res);
    if (!scope) return;
    const reports = await MonthlyReport.find({ scopeKey: scope.scopeKey, year: period.year })
      .select('month submittedAt').lean();
    const byMonth = new Map(reports.map(r => [r.month, r]));
    res.json({
      success: true,
      data: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        submitted: Boolean(byMonth.get(i + 1)?.submittedAt),
        submittedAt: byMonth.get(i + 1)?.submittedAt || null,
      })),
    });
  } catch (error) {
    console.error('Report status error:', error);
    fail(res, 500, 'Failed to load report status');
  }
});

// ───────────────────────────── Consolidated view ─────────────────────────────

/** Add-up number columns for a level: the latest version's, then retired ones that still hold data. */
async function numberColumns(level, totals) {
  const versions = await ReportFormVersion.find({ level }).sort({ version: 1 }).select('fields').lean();
  if (versions.length === 0) return [];
  // Later versions overwrite earlier labels, so a renamed question shows its current name.
  const byId = new Map();
  for (const v of versions) for (const c of sumColumns(v.fields)) byId.set(c.id, c);
  const latest = sumColumns(versions[versions.length - 1].fields);
  const latestIds = new Set(latest.map(c => c.id));
  const retired = [...byId.values()].filter(c => !latestIds.has(c.id) && totals[c.id]);
  return [...latest, ...retired.map(c => ({ ...c, retired: true }))];
}

// @route GET /api/monthly-reports/consolidated?year&month[&district] — hierarchy-scoped totals
router.get('/consolidated', async (req, res) => {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return fail(res, 400, period.error);
    const scope = await scopeOrFail(req, res);
    if (!scope) return;
    await ensureForms();

    const all = scope.view === 'all';
    const areaOnly = !all && Boolean(scope.view.area);
    let districtQuery = { isActive: { $ne: false } };
    if (all && req.query.district !== undefined && req.query.district !== 'all') {
      if (!isObjectId(req.query.district)) return fail(res, 400, 'Invalid district');
      districtQuery = { ...districtQuery, _id: req.query.district };
    } else if (!all) {
      districtQuery = { _id: scope.view.district };
    }

    const districts = await District.find(districtQuery).select('name').lean();
    const districtIds = districts.map(d => d._id);
    const areas = await Group.find({
      district: { $in: districtIds },
      isActive: { $ne: false },
      ...(areaOnly ? { _id: scope.view.area } : {}),
    }).select('name district').lean();
    const areaIds = areas.map(a => a._id);

    const scopes = [{ level: 'area', area: { $in: areaIds } }];
    if (!areaOnly) scopes.push({ level: 'district', district: { $in: districtIds } });
    if (all) scopes.push({ level: 'state' });
    const reports = await MonthlyReport.find({ ...period, $or: scopes })
      .select('level district area submittedAt lastEditedAt unlockedUntil numbers').lean();

    const tree = consolidate({ districts, areas, reports, includeState: all });
    const forms = await ReportForm.find().select('level deadlineDay').lean();
    const deadlines = Object.fromEntries(forms.map(f => [f.level, editState({ ...period, deadlineDay: f.deadlineDay }).deadline]));

    const [stateColumns, districtColumns, areaColumns] = await Promise.all([
      all ? numberColumns('state', tree.totals.state) : [],
      areaOnly ? [] : numberColumns('district', tree.totals.district),
      numberColumns('area', tree.totals.area),
    ]);

    res.json({
      success: true,
      data: {
        period,
        current: currentPeriod(),
        viewer: { level: scope.level, view: all ? 'all' : areaOnly ? 'area' : 'district' },
        canUnlock: {
          state: req.user.role === 'state_admin',
          district: req.user.role === 'state_admin',
          area: req.user.role === 'state_admin' || req.user.role === 'district_admin',
        },
        columns: { state: stateColumns, district: districtColumns, area: areaColumns },
        deadlines,
        ...tree,
      },
    });
  } catch (error) {
    console.error('Consolidated report error:', error);
    fail(res, 500, 'Failed to build the consolidated report');
  }
});

// @route POST /api/monthly-reports/unlock — reopen a locked month for 7 days (higher level only)
router.post('/unlock', async (req, res) => {
  try {
    const period = parsePeriod(req.body || {});
    if (period.error) return fail(res, 400, period.error);
    const { level, scopeId } = req.body || {};
    if (!REPORT_LEVELS.includes(level)) return fail(res, 400, 'Unknown report level');

    const isState = req.user.role === 'state_admin';
    let target;
    if (level === 'state') {
      if (!isState) return fail(res, 403, 'Only a state admin can unlock this report');
      target = { scopeKey: 'state' };
    } else if (level === 'district') {
      if (!isState) return fail(res, 403, 'Only a state admin can unlock a district report');
      if (!isObjectId(scopeId) || !(await District.exists({ _id: scopeId }))) return fail(res, 404, 'District not found');
      target = { scopeKey: `district:${scopeId}`, district: scopeId };
    } else {
      if (!isObjectId(scopeId)) return fail(res, 404, 'Area not found');
      const group = await Group.findById(scopeId).select('district').lean();
      if (!group) return fail(res, 404, 'Area not found');
      const ownDistrict = String(req.user.district?._id || req.user.district || '');
      if (!isState && !(req.user.role === 'district_admin' && String(group.district) === ownDistrict)) {
        return fail(res, 403, 'You can only unlock areas in your own district');
      }
      target = { scopeKey: `area:${scopeId}`, district: group.district, area: scopeId };
    }

    if (editState({ ...period, deadlineDay: 28 }).future) return fail(res, 400, 'That month has not started yet');

    const now = new Date();
    const until = new Date(now.getTime() + UNLOCK_DAYS * 24 * 60 * 60 * 1000);
    const { scopeKey, ...where } = target;
    await MonthlyReport.findOneAndUpdate(
      { scopeKey, ...period },
      {
        $setOnInsert: { level, ...where },
        $set: { unlockedUntil: until, unlockedBy: req.user._id },
        $push: { history: { by: req.user._id, at: now, action: 'unlocked', changed: [] } },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ success: true, message: `Unlocked until ${until.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, data: { unlockedUntil: until } });
  } catch (error) {
    console.error('Unlock report error:', error);
    fail(res, 500, 'Failed to unlock the report');
  }
});

// @route GET /api/monthly-reports/:id — one report with the form it was filled on and its history
router.get('/:id', async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return fail(res, 400, 'Invalid report id');
    const report = await withPeople(MonthlyReport.findById(req.params.id))
      .populate('district', 'name').populate('area', 'name').lean();
    if (!report) return fail(res, 404, 'Report not found');
    const scope = await scopeOrFail(req, res);
    if (!scope) return;
    if (!scopeCovers(scope, report)) return fail(res, 403, 'This report is outside your area');

    const published = await publishedForm(report.level, report.formVersion);
    const scopeLabel = report.level === 'state' ? 'State' : report.level === 'district' ? report.district?.name : report.area?.name;
    res.json({
      success: true,
      data: {
        scopeLabel: scopeLabel || '',
        districtName: report.district?.name || null,
        form: published ? { version: published.version, title: published.title, fields: published.fields } : null,
        report: reportView(report),
      },
    });
  } catch (error) {
    console.error('Get report error:', error);
    fail(res, 500, 'Failed to load the report');
  }
});

export default router;
