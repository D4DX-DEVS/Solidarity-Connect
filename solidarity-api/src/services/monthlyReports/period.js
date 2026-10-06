// Report months, deadlines and lock state. All in IST.
import { orgYearMonth } from '../../utils/orgTime.js';

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Parse ?year=&month= into numbers, rejecting anything that is not a plain value. */
export function parsePeriod(query) {
  const year = typeof query?.year === 'string' || typeof query?.year === 'number' ? Number(query.year) : NaN;
  const month = typeof query?.month === 'string' || typeof query?.month === 'number' ? Number(query.month) : NaN;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'year must be between 2020 and 2100' };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: 'month must be 1–12' };
  return { year, month };
}

/** The current report month in IST, 1-based. */
export function currentPeriod(now = new Date()) {
  const { year, month } = orgYearMonth(now);
  return { year, month: month + 1 };
}

/** Last moment a month's report can be edited: `deadlineDay` of the next month, 23:59:59.999 IST. */
export function deadlineFor(year, month, deadlineDay) {
  const localMidnight = Date.UTC(year, month, deadlineDay + 1); // month is 1-based → index of next month
  return new Date(localMidnight - IST_OFFSET_MINUTES * 60 * 1000 - 1);
}

/**
 * Whether a month's report can be edited now.
 * Future months are never open. A past deadline can be extended by an unlock.
 */
export function editState({ year, month, deadlineDay, unlockedUntil = null, now = new Date() }) {
  const current = currentPeriod(now);
  const future = year > current.year || (year === current.year && month > current.month);
  const deadline = deadlineFor(year, month, deadlineDay);
  const unlock = unlockedUntil ? new Date(unlockedUntil) : null;
  const editableUntil = unlock && unlock > deadline ? unlock : deadline;
  const locked = future || now > editableUntil;
  return { locked, future, deadline, editableUntil };
}
