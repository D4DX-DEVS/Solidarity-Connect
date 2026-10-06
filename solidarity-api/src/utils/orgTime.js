// The organisation runs on Kerala time. Months, deadlines and reporting windows
// follow IST, not the server clock — otherwise the first hours of a month fall in
// the last one.
export const ORG_TIME_ZONE = 'Asia/Kolkata';

/** Calendar year and 0-based month of `now` in the org's time zone. */
export function orgYearMonth(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ORG_TIME_ZONE, year: 'numeric', month: 'numeric' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month') - 1 };
}
