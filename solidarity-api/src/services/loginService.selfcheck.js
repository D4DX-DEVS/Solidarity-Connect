/**
 * Self-check for loginService's pure helpers — the bits that decide whether a
 * stored phone matches the one typed at login, and what an account is called.
 * Both are easy to break silently and expensive to get wrong (a bad variant list
 * means a real user's accounts simply do not appear in the picker).
 *
 * Run: node src/services/loginService.selfcheck.js
 * ponytail: plain asserts, no test framework. Promote to jest if this grows.
 */
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone, phoneVariants, accountLabel, TEST_OTP } from './loginService.js';
import msghexService, { OTP_DIGITS } from './msghexService.js';

// Every way a number reaches us must collapse to the same 10 digits.
for (const input of ['9876543210', '+919876543210', '919876543210', '09876543210', '+91 98765 43210']) {
  assert.equal(normalizePhone(input), '9876543210', `normalizePhone(${input})`);
}

assert.equal(normalizePhone(undefined), '');
assert.equal(normalizePhone(null), '');

// Indian mobiles start 6-9; anything else must be rejected before we try to send.
assert.equal(isValidPhone('9876543210'), true);
assert.equal(isValidPhone('+919876543210'), true);
assert.equal(isValidPhone('1234567890'), false, 'must reject numbers starting below 6');
assert.equal(isValidPhone('98765'), false, 'must reject short numbers');
assert.equal(isValidPhone(''), false);

// Admin rows store bare digits, member rows store +91 — a lookup must match both.
const variants = phoneVariants('+919876543210');
assert.deepEqual(new Set(variants), new Set(['9876543210', '+919876543210', '919876543210']));
assert.equal(new Set(variants).size, variants.length, 'variants must be de-duplicated');

// Area-level admins are labelled by adminKind; every other role by its role name.
assert.equal(accountLabel('group_admin', 'area'), 'Area Admin');
assert.equal(accountLabel('group_admin', 'murabi'), 'Murabi Admin');
assert.equal(accountLabel('group_admin', 'coordinator'), 'Coordinator Admin');
assert.equal(accountLabel('group_admin', undefined), 'Area Admin', 'legacy rows without adminKind are Area Admins');
assert.equal(accountLabel('state_admin', 'murabi'), 'State Admin', 'adminKind must not leak into non-area roles');
assert.equal(accountLabel('district_admin', undefined), 'District Admin');
assert.equal(accountLabel('member', null), 'Member');

// The code we deliver must be the length the login UI renders boxes for and the
// length /auth/login/verify-otp validates. A provider that mints its own code at a
// different length delivers something the user physically cannot enter.
for (let i = 0; i < 500; i += 1) {
  const code = msghexService.generateOTP();
  assert.match(code, new RegExp(`^\\d{${OTP_DIGITS}}$`), `generateOTP produced "${code}"`);
}
assert.equal(TEST_OTP.length, OTP_DIGITS, 'the test-phone code must be the same length as a real one');

console.log(`loginService self-check passed (OTP_DIGITS=${OTP_DIGITS})`);
