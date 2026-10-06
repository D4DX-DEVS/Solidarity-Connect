// Self-check for the "Age over" archive rule. Run: node src/utils/age-over.check.mjs
import assert from 'node:assert/strict';
import { ageCutoff, ageOverCutoff, ageOverMatch, agedOutSince, currentMemberMatch, isAgeOver, ageOn, AGE_OVER_STATUS } from './ageOver.js';

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// Noon IST on a calendar day
const istNoon = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 6, 30));

// Cutoff: born on or before this date = 38 or older
assert.deepEqual(ageOverCutoff(istNoon(2026, 10, 6)), utc(1988, 10, 6));

// Cutoff follows the IST calendar day: 7 Oct 00:30 IST is still 6 Oct 19:00 UTC
assert.deepEqual(ageOverCutoff(new Date(Date.UTC(2026, 9, 6, 19, 0))), utc(1988, 10, 7));

// 29 Feb today, 38 years back is not a leap year — clamp to 28 Feb, don't roll into March
assert.deepEqual(ageOverCutoff(istNoon(2028, 2, 29)), utc(1990, 2, 28));

// isAgeOver: 38th birthday is the first archived day
const today = istNoon(2026, 10, 6);
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1988, 10, 6) }, today), true); // exactly 38
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1988, 10, 7) }, today), false); // 38 tomorrow
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1989, 10, 6) }, today), false); // exactly 37
// Manual status archives regardless of DOB; no DOB and bad DOB never archive
assert.equal(isAgeOver({ status: AGE_OVER_STATUS }, today), true);
assert.equal(isAgeOver({ status: 'Active' }, today), false);
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: 'not-a-date' }, today), false);
// DOB as an ISO string (JSON / lean docs)
assert.equal(isAgeOver({ status: 'Abroad', dateOfBirth: '1980-01-01T00:00:00.000Z' }, today), true);

// ageOn agrees with the cutoff, including the leap-day edge
assert.equal(ageOn(utc(1987, 10, 6), today), 39);
assert.equal(ageOn(utc(1987, 10, 7), today), 38);
assert.equal(ageOn(utc(1988, 2, 29), istNoon(2027, 2, 28)), 38);
assert.equal(ageOn(utc(1988, 2, 29), istNoon(2027, 3, 1)), 39);
assert.equal(ageOn(null, today), null);

// ageCutoff: exactly 40 = DOB in (ageCutoff(41), ageCutoff(40)]
assert.deepEqual(ageCutoff(40, today), utc(1986, 10, 6));
assert.equal(ageOn(ageCutoff(40, today), today), 40);
assert.equal(ageOn(new Date(ageCutoff(41, today).getTime() + 864e5), today), 40);

// agedOutSince: first DOB that turned 38 this IST month / year
assert.deepEqual(agedOutSince('month', today), utc(1988, 10, 1));
assert.deepEqual(agedOutSince('year', today), utc(1988, 1, 1));
// 1 Nov 00:30 IST is still 31 Oct UTC — already November's window
assert.deepEqual(agedOutSince('month', new Date(Date.UTC(2026, 9, 31, 19, 0))), utc(1988, 11, 1));

// Mongo matches: archived = manual status OR DOB on/before cutoff; current = neither.
// $nor keeps the current-members match from colliding with a filter's own $or (search).
const archived = ageOverMatch(today);
assert.deepEqual(archived, { $or: [{ status: AGE_OVER_STATUS }, { dateOfBirth: { $lte: utc(1988, 10, 6) } }] });
assert.deepEqual(currentMemberMatch(today), { $nor: archived.$or });
const merged = { $or: [{ name: /x/ }], ...currentMemberMatch(today) };
assert.ok(merged.$or && merged.$nor);

console.log('age-over check: OK');
