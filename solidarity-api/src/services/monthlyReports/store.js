// Monthly reports: database helpers shared by the admin and member routes.
import ReportForm from '../../models/ReportForm.js';
import ReportFormVersion from '../../models/ReportFormVersion.js';
import Group from '../../models/Group.js';
import { isAreaLevelAdmin, areaGroupIdsFor } from '../../middleware/auth.js';
import { REPORT_LEVELS, normaliseFormFields } from './fields.js';
import { DEFAULT_FORMS } from './defaultForms.js';

let formsReady = false;

/**
 * Seed and publish the starter form for any level that has none yet.
 * Idempotent and race-safe: the unique indexes reject a second insert.
 */
export async function ensureForms() {
  if (formsReady) return;
  for (const level of REPORT_LEVELS) {
    const exists = await ReportForm.exists({ level });
    if (exists) continue;
    const { title, fields: raw } = DEFAULT_FORMS[level];
    const { fields, nextFieldId } = normaliseFormFields(raw, { savedIds: [], nextFieldId: 1 });
    try {
      await ReportFormVersion.create({ level, version: 1, title, fields });
      await ReportForm.create({ level, title, fields, nextFieldId, version: 1, publishedAt: new Date() });
    } catch (error) {
      if (error?.code !== 11000) throw error; // another request seeded it first
    }
  }
  formsReady = true;
}

/** Fields of a published form version, or null when that version does not exist. */
export async function publishedForm(level, version) {
  if (!version) return null;
  return ReportFormVersion.findOne({ level, version }).select('level version title fields').lean();
}

const idOf = (value) => (value ? String(value._id ?? value) : null);

/** Area proper (roleTag 'area') — the only group admins who fill the area report. */
export const isAreaAdminProper = (user) =>
  user?.role === 'group_admin' && user.roleTag?.type === 'area' &&
  user.adminKind !== 'murabi' && user.adminKind !== 'coordinator';

/** The area (group) an admin belongs to — same rule as member scoping. */
export async function areaOf(user) {
  if (isAreaLevelAdmin(user)) {
    const ids = await areaGroupIdsFor(user);
    if (ids.length > 0) return idOf(ids[0]);
    if (user.roleTag?.areaId) return idOf(user.roleTag.areaId);
  }
  return idOf(user.group);
}

/**
 * Where an admin sits for monthly reports.
 *   level/scopeKey/district/area — the report they own or view as "theirs"
 *   canFill — may create and edit that report
 *   view    — what the consolidated view covers: 'all' | { district } | { district, area }
 * Returns null for an admin with no resolvable scope.
 */
export async function reportScopeFor(user) {
  if (user.role === 'state_admin') {
    return { level: 'state', scopeKey: 'state', district: null, area: null, canFill: true, view: 'all', label: 'State' };
  }
  if (user.role === 'district_admin') {
    const district = idOf(user.district);
    if (!district) return null;
    return {
      level: 'district', scopeKey: `district:${district}`, district, area: null,
      canFill: true, view: { district }, label: user.district?.name || 'District',
    };
  }
  if (user.role === 'group_admin') {
    const area = await areaOf(user);
    if (!area) return null;
    const group = await Group.findById(area).select('name district').lean();
    if (!group) return null;
    const district = idOf(group.district);
    return {
      level: 'area', scopeKey: `area:${area}`, district, area,
      canFill: isAreaAdminProper(user), view: { district, area }, label: group.name,
    };
  }
  return null;
}

/** Whether a viewer scope covers a report. */
export function scopeCovers(scope, report) {
  if (!scope) return false;
  if (scope.view === 'all') return true;
  if (scope.view.area) return report.level === 'area' && idOf(report.area) === scope.view.area;
  return report.level !== 'state' && idOf(report.district) === scope.view.district;
}

/** Uploaded files must come from our own storage — same base URL the uploads route builds. */
export function isAllowedFileUrl(url) {
  const bucket = process.env.DO_SPACES_BUCKET;
  const cdn = process.env.DO_SPACES_CDN_ENDPOINT;
  const base = cdn
    ? cdn.replace(/\/$/, '')
    : bucket && process.env.DO_SPACES_ENDPOINT
      ? `https://${bucket}.${process.env.DO_SPACES_ENDPOINT.replace('https://', '')}`
      : null;
  // Without storage configured (local dev) only the scheme check applies.
  return base ? url.startsWith(`${base}/`) : true;
}
