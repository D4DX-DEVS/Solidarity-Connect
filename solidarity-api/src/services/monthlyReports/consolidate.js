// One month's reports rolled up the hierarchy: each area under its district,
// area numbers summed per district and statewide, district numbers summed
// statewide. Only submitted reports count — an unlock with no submission is
// still "missing".

const idOf = (value) => (value === null || value === undefined ? null : String(value._id ?? value));

function addInto(totals, numbers) {
  for (const { fieldId, value } of numbers || []) {
    totals[fieldId] = (totals[fieldId] || 0) + value;
  }
}

const ENTRIES_KEY = /^g\d+$/;
const ANSWER_KEY = /^f(\d+)$/;

/**
 * An area report's per-unit rows: every named entry of its repeating sections,
 * with the numbers it was given. A unit named in two sections is one row.
 * @returns {{ name: string, numbers: Record<string, number> }[]}
 */
export function unitsOf(answers) {
  const units = new Map();
  for (const [key, entries] of Object.entries(answers || {})) {
    if (!ENTRIES_KEY.test(key) || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
      if (!name) continue;
      const unit = units.get(name.toLowerCase()) || { name, numbers: {} };
      for (const [answerKey, value] of Object.entries(entry)) {
        const match = ANSWER_KEY.exec(answerKey);
        if (match && typeof value === 'number' && Number.isFinite(value)) unit.numbers[match[1]] = (unit.numbers[match[1]] || 0) + value;
      }
      units.set(name.toLowerCase(), unit);
    }
  }
  return [...units.values()];
}

/** Units of several reports (a year's months) added up by name, first-seen order. */
function addUnits(into, units) {
  for (const unit of units) {
    const key = unit.name.toLowerCase();
    const existing = into.get(key) || { name: unit.name, numbers: {} };
    for (const [fieldId, value] of Object.entries(unit.numbers)) existing.numbers[fieldId] = (existing.numbers[fieldId] || 0) + value;
    into.set(key, existing);
  }
}

function summary(report) {
  if (!report) return { submitted: false, reportId: null, numbers: {} };
  const numbers = {};
  if (report.submittedAt) addInto(numbers, report.numbers);
  return {
    submitted: Boolean(report.submittedAt),
    reportId: idOf(report._id),
    submittedAt: report.submittedAt || null,
    lastEditedAt: report.lastEditedAt || null,
    unlockedUntil: report.unlockedUntil || null,
    numbers,
    // Area reports break down by unit; a year's months arrive already merged
    ...(report.level === 'area' ? { units: report.submittedAt ? report.units ?? unitsOf(report.answers) : [] } : {}),
    ...(report.monthsSubmitted === undefined ? {} : { monthsSubmitted: report.monthsSubmitted }),
  };
}

const scopeKeyOf = (r) => (r.level === 'state' ? 'state' : r.level === 'district' ? `district:${idOf(r.district)}` : `area:${idOf(r.area)}`);

/**
 * @param {{ districts: {_id, name}[], areas: {_id, name, district}[], reports: object[], includeState: boolean }} input
 *   districts/areas are the ones in the viewer's scope; reports are that month's reports in scope.
 */
export function consolidate({ districts, areas, reports, includeState }) {
  const byScope = new Map();
  for (const r of reports) byScope.set(scopeKeyOf(r), r);

  const totals = { state: {}, district: {}, area: {} };
  const counts = { districts: { submitted: 0, total: districts.length }, areas: { submitted: 0, total: areas.length } };

  const areasByDistrict = new Map();
  for (const area of areas) {
    const key = idOf(area.district);
    if (!areasByDistrict.has(key)) areasByDistrict.set(key, []);
    areasByDistrict.get(key).push(area);
  }

  const districtRows = districts.map((district) => {
    const id = idOf(district._id);
    const report = summary(byScope.get(`district:${id}`));
    if (report.submitted) {
      counts.districts.submitted += 1;
      addInto(totals.district, Object.entries(report.numbers).map(([fieldId, value]) => ({ fieldId, value })));
    }

    const areaTotals = {};
    let areasSubmitted = 0;
    const areaRows = (areasByDistrict.get(id) || [])
      .map((area) => {
        const areaReport = summary(byScope.get(`area:${idOf(area._id)}`));
        if (areaReport.submitted) {
          areasSubmitted += 1;
          const entries = Object.entries(areaReport.numbers).map(([fieldId, value]) => ({ fieldId, value }));
          addInto(areaTotals, entries);
          addInto(totals.area, entries);
        }
        return { id: idOf(area._id), name: area.name, report: areaReport };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    counts.areas.submitted += areasSubmitted;

    return { id, name: district.name, report, areas: areaRows, areasSubmitted, areaTotals };
  }).sort((a, b) => a.name.localeCompare(b.name));

  let state = null;
  if (includeState) {
    state = summary(byScope.get('state'));
    if (state.submitted) addInto(totals.state, Object.entries(state.numbers).map(([fieldId, value]) => ({ fieldId, value })));
  }

  return { state, districts: districtRows, totals, counts };
}

/**
 * A year's months merged into one report per scope: submitted months' numbers summed,
 * how many months were submitted, and no single report id (there is nothing one to open).
 */
function mergeYear(reports) {
  const byScope = new Map();
  for (const r of reports) {
    const key = scopeKeyOf(r);
    const merged = byScope.get(key) || {
      _id: null, level: r.level, district: r.district, area: r.area, submittedAt: null, monthsSubmitted: 0, totals: {}, unitTotals: new Map(),
    };
    if (r.submittedAt) {
      merged.monthsSubmitted += 1;
      addInto(merged.totals, r.numbers);
      if (r.level === 'area') addUnits(merged.unitTotals, unitsOf(r.answers));
      if (!merged.submittedAt || r.submittedAt > merged.submittedAt) merged.submittedAt = r.submittedAt;
    }
    byScope.set(key, merged);
  }
  return [...byScope.values()].map(({ totals, unitTotals, ...merged }) => ({
    ...merged,
    numbers: Object.entries(totals).map(([fieldId, value]) => ({ fieldId, value })),
    ...(merged.level === 'area' ? { units: [...unitTotals.values()] } : {}),
  }));
}

const withMonths = (report) => ({ ...report, monthsSubmitted: report.monthsSubmitted ?? 0 });
const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * A calendar year rolled up like consolidate(), every submitted month added together.
 * `months` is how many of the year's months have started, for "9 of 10 months" counts.
 */
export function consolidateYear({ districts, areas, reports, includeState, months }) {
  const tree = consolidate({ districts, areas, reports: mergeYear(reports), includeState });
  const districtRows = tree.districts.map((district) => {
    const areaRows = district.areas.map(area => ({ ...area, report: withMonths(area.report) }));
    return {
      ...district,
      report: withMonths(district.report),
      areas: areaRows,
      areaMonthsSubmitted: sum(areaRows.map(a => a.report.monthsSubmitted)),
    };
  });
  const state = tree.state ? withMonths(tree.state) : null;

  return {
    ...tree,
    state,
    districts: districtRows,
    counts: {
      ...tree.counts,
      months: {
        district: { submitted: sum(districtRows.map(d => d.report.monthsSubmitted)), total: districts.length * months },
        area: { submitted: sum(districtRows.map(d => d.areaMonthsSubmitted)), total: areas.length * months },
        state: state ? { submitted: state.monthsSubmitted, total: months } : null,
      },
    },
  };
}
