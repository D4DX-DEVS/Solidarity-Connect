/**
 * "Age over" archive rule. A member is archived from their 38th birthday
 * (aged 38 and above) or when a state admin sets status "Age over" by hand.
 * Archived members drop out of the Members list, dashboards and reports, and
 * only the state admin sees them, on the Archives page.
 *
 * Worked out from dateOfBirth at query time and never written back, so the
 * stored status (Active, Abroad…) survives and a corrected DOB restores the
 * member on its own.
 */
export const AGE_OVER_STATUS = 'Age over';
export const AGE_OVER_MIN_AGE = 38;

// Birthdays turn over on the Kerala calendar day, not the server's.
const ORG_TIME_ZONE = 'Asia/Kolkata';

function orgDate(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ORG_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Latest date of birth that is `minAge` or older today. DOBs are stored at UTC
 * midnight, so `dateOfBirth <= cutoff` means that birthday has come.
 */
export function ageCutoff(minAge, now = new Date()) {
  const { year, month, day } = orgDate(now);
  const cutoffYear = year - minAge;
  // 29 Feb has no twin in a non-leap year: use 28 Feb rather than rolling into March.
  const lastDay = new Date(Date.UTC(cutoffYear, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cutoffYear, month, Math.min(day, lastDay)));
}

/** Latest date of birth that is age over (38 or older) today. */
export function ageOverCutoff(now = new Date()) {
  return ageCutoff(AGE_OVER_MIN_AGE, now);
}

/**
 * Earliest date of birth that turned 38 in the current IST month or year;
 * `since <= dateOfBirth <= ageOverCutoff()` = aged out in that period so far.
 */
export function agedOutSince(period, now = new Date()) {
  const { year, month } = orgDate(now);
  return new Date(Date.UTC(year - AGE_OVER_MIN_AGE, period === 'year' ? 0 : month, 1));
}

/** Mongo match for archived members. */
export function ageOverMatch(now = new Date()) {
  return { $or: [{ status: AGE_OVER_STATUS }, { dateOfBirth: { $lte: ageOverCutoff(now) } }] };
}

/** Mongo match for current members; spread it into a filter (its $nor never clashes with a search $or). */
export function currentMemberMatch(now = new Date()) {
  return { $nor: ageOverMatch(now).$or };
}

export function isAgeOver(member, now = new Date()) {
  if (member?.status === AGE_OVER_STATUS) return true;
  const dob = toDate(member?.dateOfBirth);
  return !!dob && dob <= ageOverCutoff(now);
}

/** Whole years on today's IST date, or null without a usable DOB. */
export function ageOn(dateOfBirth, now = new Date()) {
  const dob = toDate(dateOfBirth);
  if (!dob) return null;
  const { year, month, day } = orgDate(now);
  const birthdayPassed = month > dob.getUTCMonth() || (month === dob.getUTCMonth() && day >= dob.getUTCDate());
  return year - dob.getUTCFullYear() - (birthdayPassed ? 0 : 1);
}
