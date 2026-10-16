/**
 * "Age over" archive rule, by birth year and two-year term (user decision 2026-10-16).
 *
 * Terms start on 1 January of 2027, 2029, 2031, … (IST). From the first term on,
 * members born in 1986 or earlier are age over; each later term moves the cutoff
 * one birth year on (1987 from 1 Jan 2029, 1988 from 1 Jan 2031, …). Before
 * 2027 nobody is age over by date of birth. A state admin can still set status
 * "Age over" by hand, which archives a member at any time.
 *
 * Archived members are listed on the state admin's Archives page only; Members
 * and Role Management do not tag them. Whether they are also kept out of
 * Members, dashboards, reports and non-state roles is ARCHIVE_RESTRICTED below.
 *
 * Worked out from dateOfBirth at query time and never written back, so the
 * stored status (Active, Abroad…) survives and a corrected DOB restores the
 * member on its own.
 */
export const AGE_OVER_STATUS = 'Age over';

/** First term start year, and the last birth year that is age over in that term. */
export const FIRST_TERM_YEAR = 2027;
export const FIRST_TERM_CUTOFF_BIRTH_YEAR = 1986;
export const TERM_YEARS = 2;

/**
 * Off (2026-10-07): archived members count and show everywhere, for every role,
 * like current ones. Set true to keep them out of Members, dashboards and reports
 * and hide them from everyone but the state admin.
 */
export const ARCHIVE_RESTRICTED = false;

// Terms turn over on the Kerala calendar day, not the server's.
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

/** The term a calendar year falls in: start year and cutoff birth year, or null before the first term. */
function termOfYear(year) {
  if (year < FIRST_TERM_YEAR) return null;
  const index = Math.floor((year - FIRST_TERM_YEAR) / TERM_YEARS);
  return {
    startYear: FIRST_TERM_YEAR + index * TERM_YEARS,
    cutoffBirthYear: FIRST_TERM_CUTOFF_BIRTH_YEAR + index,
  };
}

/**
 * Last birth year that is age over today (IST), or null while no term has started.
 */
export function ageOverBirthYear(now = new Date()) {
  return termOfYear(orgDate(now).year)?.cutoffBirthYear ?? null;
}

/**
 * Earliest date of birth that is NOT age over today: 1 Jan of the year after the
 * cutoff birth year, or null while no term has started. DOBs are stored at UTC
 * midnight, so `dateOfBirth < bound` means age over.
 */
export function ageOverBound(now = new Date()) {
  const year = ageOverBirthYear(now);
  return year === null ? null : new Date(Date.UTC(year + 1, 0, 1));
}

/**
 * The rule as it stands today and its next change, for the Archives page:
 * { cutoffBirthYear, termStart, next: { date, cutoffBirthYear } }. Dates are
 * 'YYYY-MM-DD' (1 January IST).
 */
export function ageOverRule(now = new Date()) {
  const { year } = orgDate(now);
  const current = termOfYear(year);
  const nextStart = current ? current.startYear + TERM_YEARS : FIRST_TERM_YEAR;
  return {
    cutoffBirthYear: current?.cutoffBirthYear ?? null,
    termStart: current ? `${current.startYear}-01-01` : null,
    next: { date: `${nextStart}-01-01`, cutoffBirthYear: termOfYear(nextStart).cutoffBirthYear },
  };
}

/** Mongo match for archived members. */
export function ageOverMatch(now = new Date()) {
  const bound = ageOverBound(now);
  const byStatus = { status: AGE_OVER_STATUS };
  return { $or: bound ? [byStatus, { dateOfBirth: { $lt: bound } }] : [byStatus] };
}

/** Mongo match for members who are not archived; spread it into a filter (its $nor never clashes with a search $or). */
export function notAgeOverMatch(now = new Date()) {
  return { $nor: ageOverMatch(now).$or };
}

/** Members that count and show in day-to-day views: all of them unless ARCHIVE_RESTRICTED. */
export function currentMemberMatch(now = new Date()) {
  return ARCHIVE_RESTRICTED ? notAgeOverMatch(now) : {};
}

/** True when this member must be answered as "not found" for this user. */
export function hiddenAsArchived(user, member, now = new Date()) {
  return ARCHIVE_RESTRICTED && user?.role !== 'state_admin' && isAgeOver(member, now);
}

export function isAgeOver(member, now = new Date()) {
  if (member?.status === AGE_OVER_STATUS) return true;
  const dob = toDate(member?.dateOfBirth);
  const bound = ageOverBound(now);
  return !!dob && !!bound && dob < bound;
}

/** Whole years on today's IST date, or null without a usable DOB. */
export function ageOn(dateOfBirth, now = new Date()) {
  const dob = toDate(dateOfBirth);
  if (!dob) return null;
  const { year, month, day } = orgDate(now);
  const birthdayPassed = month > dob.getUTCMonth() || (month === dob.getUTCMonth() && day >= dob.getUTCDate());
  return year - dob.getUTCFullYear() - (birthdayPassed ? 0 : 1);
}
