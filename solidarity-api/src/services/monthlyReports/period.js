// Report months, deadlines and lock state. All in IST.
import { orgYearMonth } from '../../utils/orgTime.js';

const IST_OFFSET_MINUTES = 5 * 60 + 30;

const plainNumber = (value) => (typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN);

/** Parse ?year= for a whole-year view, rejecting anything that is not a plain value. */
export function parseYear(query) {
  const year = plainNumber(query?.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'year must be between 2020 and 2100' };
  return { year };
}

/** Parse ?year=&month= into numbers, rejecting anything that is not a plain value. */
export function parsePeriod(query) {
  const parsed = parseYear(query);
  if (parsed.error) return parsed;
  const month = plainNumber(query?.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: 'month must be 1–12' };
  return { year: parsed.year, month };
}

/** The current report month in IST, 1-based. */
export function currentPeriod(now = new Date()) {
  const { year, month } = orgYearMonth(now);
  return { year, month: month + 1 };
}

/** Report months of `year` that have started (IST): 12 for a past year, 0 for a future one. */
export function monthsElapsed(year, now = new Date()) {
  const current = currentPeriod(now);
  if (year < current.year) return 12;
  if (year > current.year) return 0;
  return current.month;
}

/**
 * When a month's report is due: `deadlineDay` of the next month, 23:59:59.999 IST.
 * A reminder for the dashboards only — the report stays editable longer (lockTimeFor).
 */
export function deadlineFor(year, month, deadlineDay) {
  const localMidnight = Date.UTC(year, month, deadlineDay + 1); // month is 1-based → index of next month
  return new Date(localMidnight - IST_OFFSET_MINUTES * 60 * 1000 - 1);
}

/** A report stays open for its own month and the two after it: in October, August to October can be edited. */
export const EDIT_WINDOW_MONTHS = 3;

/** Last moment a month's report can be edited: the end of its window, 23:59:59.999 IST. */
export function lockTimeFor(year, month) {
  const localMidnight = Date.UTC(year, month - 1 + EDIT_WINDOW_MONTHS, 1); // first day after the window
  return new Date(localMidnight - IST_OFFSET_MINUTES * 60 * 1000 - 1);
}

/**
 * Whether a month's report can be edited now: from the month's start to the end of
 * its edit window. Future months are never open. A higher level's unlock reopens a
 * locked month for a while.
 */
export function editState({ year, month, unlockedUntil = null, now = new Date() }) {
  const current = currentPeriod(now);
  const future = year > current.year || (year === current.year && month > current.month);
  const deadline = lockTimeFor(year, month);
  const unlock = unlockedUntil ? new Date(unlockedUntil) : null;
  const editableUntil = unlock && unlock > deadline ? unlock : deadline;
  const locked = future || now > editableUntil;
  return { locked, future, deadline, editableUntil };
}
