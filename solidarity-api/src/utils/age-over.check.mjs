// Self-check for the "Age over" archive rule. Run: node src/utils/age-over.check.mjs
import assert from 'node:assert/strict';
import { ageOverBirthYear, ageOverBound, ageOverMatch, ageOverRule, currentMemberMatch, hiddenAsArchived, isAgeOver, notAgeOverMatch, ageOn, AGE_OVER_STATUS, ARCHIVE_RESTRICTED } from './ageOver.js';

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// Noon IST on a calendar day
const istNoon = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 6, 30));

// Before the first term (1 Jan 2027) nobody is age over by date of birth
const before = istNoon(2026, 10, 16);
assert.equal(ageOverBirthYear(before), null);
assert.equal(ageOverBound(before), null);
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1950, 1, 1) }, before), false);
assert.deepEqual(ageOverMatch(before), { $or: [{ status: AGE_OVER_STATUS }] });
assert.equal(isAgeOver({ status: AGE_OVER_STATUS }, before), true);
assert.deepEqual(ageOverRule(before), { cutoffBirthYear: null, termStart: null, next: { date: '2027-01-01', cutoffBirthYear: 1986 } });

// Term 2027–2028: born 1986 or earlier
for (const now of [istNoon(2027, 1, 1), istNoon(2027, 7, 1), istNoon(2028, 12, 31)]) {
  assert.equal(ageOverBirthYear(now), 1986);
  assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1986, 12, 31) }, now), true);
  assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1987, 1, 1) }, now), false);
}
assert.deepEqual(ageOverBound(istNoon(2027, 3, 1)), utc(1987, 1, 1));
assert.deepEqual(ageOverRule(istNoon(2027, 3, 1)), { cutoffBirthYear: 1986, termStart: '2027-01-01', next: { date: '2029-01-01', cutoffBirthYear: 1987 } });

// Term 2029–2030: born 1987 or earlier; 2031–2032: 1988
assert.equal(ageOverBirthYear(istNoon(2029, 1, 1)), 1987);
assert.equal(ageOverBirthYear(istNoon(2030, 12, 31)), 1987);
assert.equal(ageOverBirthYear(istNoon(2031, 1, 1)), 1988);
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: utc(1987, 6, 1) }, istNoon(2029, 1, 1)), true);

// Terms turn over on the IST calendar day: 1 Jan 2027 00:30 IST is still 31 Dec 2026 in UTC
assert.equal(ageOverBirthYear(new Date(Date.UTC(2026, 11, 31, 19, 0))), 1986);
assert.equal(ageOverBirthYear(new Date(Date.UTC(2026, 11, 31, 18, 0))), null);

// No DOB and bad DOB never archive; DOB as an ISO string (JSON / lean docs) works
const inTerm = istNoon(2027, 5, 1);
assert.equal(isAgeOver({ status: 'Active' }, inTerm), false);
assert.equal(isAgeOver({ status: 'Active', dateOfBirth: 'not-a-date' }, inTerm), false);
assert.equal(isAgeOver({ status: 'Abroad', dateOfBirth: '1980-01-01T00:00:00.000Z' }, inTerm), true);

// Match and its negation
assert.deepEqual(ageOverMatch(inTerm), { $or: [{ status: AGE_OVER_STATUS }, { dateOfBirth: { $lt: utc(1987, 1, 1) } }] });
assert.deepEqual(notAgeOverMatch(inTerm), { $nor: ageOverMatch(inTerm).$or });

// ageOn still counts whole years on the IST date
assert.equal(ageOn(utc(1988, 10, 6), istNoon(2026, 10, 6)), 38);
assert.equal(ageOn(utc(1988, 10, 7), istNoon(2026, 10, 6)), 37);
assert.equal(ageOn(null), null);

// Restriction flag
if (!ARCHIVE_RESTRICTED) {
  assert.deepEqual(currentMemberMatch(inTerm), {});
  assert.equal(hiddenAsArchived({ role: 'district_admin' }, { status: AGE_OVER_STATUS }, inTerm), false);
}

console.log('age-over checks passed');
