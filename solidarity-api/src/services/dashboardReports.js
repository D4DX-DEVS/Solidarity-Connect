// Monthly report status for the admin dashboards: which month is due now and who
// has submitted it. The dashboards show this instead of the old "admins reporting".
import { currentPeriod, deadlineFor } from './monthlyReports/period.js';

/**
 * The month admins are working on: last month until its deadline passes (IST),
 * then this month. `deadline` is that month's last editable moment. `closing` is
 * true while that month is over and its report is due (1st to the deadline), false
 * while the month is still running.
 */
export function dueReportMonth(now, deadlineDay) {
  const current = currentPeriod(now);
  const previous = current.month === 1
    ? { year: current.year - 1, month: 12 }
    : { year: current.year, month: current.month - 1 };
  const closing = now <= deadlineFor(previous.year, previous.month, deadlineDay);
  const period = closing ? previous : current;
  return { ...period, deadline: deadlineFor(period.year, period.month, deadlineDay), closing };
}

/**
 * Who has submitted the due month's report within one dashboard scope.
 * @param {{ districts: {_id}[] | null, groups: {_id, district}[], reports: {level, district, area}[] }} input
 *   districts: active districts (state view only, else null); groups: active areas in scope;
 *   reports: that month's submitted district and area reports in scope.
 */
export function reportProgress({ districts, groups, reports }) {
  const districtsIn = new Set(reports.filter((r) => r.level === 'district').map((r) => String(r.district)));
  const areasIn = new Set(reports.filter((r) => r.level === 'area').map((r) => String(r.area)));

  const areasByDistrict = new Map();
  for (const g of groups) {
    const key = String(g.district);
    const entry = areasByDistrict.get(key) || { areasSubmitted: 0, areaTotal: 0 };
    areasByDistrict.set(key, {
      areasSubmitted: entry.areasSubmitted + (areasIn.has(String(g._id)) ? 1 : 0),
      areaTotal: entry.areaTotal + 1,
    });
  }

  return {
    districts: districts
      ? { submitted: districts.filter((d) => districtsIn.has(String(d._id))).length, total: districts.length }
      : null,
    areas: { submitted: groups.filter((g) => areasIn.has(String(g._id))).length, total: groups.length },
    district: (id) => ({
      submitted: districtsIn.has(String(id)),
      ...(areasByDistrict.get(String(id)) || { areasSubmitted: 0, areaTotal: 0 }),
    }),
    area: (id) => ({ submitted: areasIn.has(String(id)) }),
  };
}
