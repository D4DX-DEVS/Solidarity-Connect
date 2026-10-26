import { SIGN_IN_STATUSES, canMemberSignIn } from '../../models/Member.js';

describe('member sign-in statuses', () => {
  test('Active and Abroad members may sign in', () => {
    expect(SIGN_IN_STATUSES).toEqual(['Active', 'Abroad']);
    expect(canMemberSignIn({ status: 'Active', isApproved: true })).toBe(true);
    expect(canMemberSignIn({ status: 'Abroad', isApproved: true })).toBe(true);
  });

  test('other statuses, unapproved members and missing records may not', () => {
    for (const status of ['Inactive', 'Applicant', 'Age over', 'Dismissed']) {
      expect(canMemberSignIn({ status, isApproved: true })).toBe(false);
    }
    expect(canMemberSignIn({ status: 'Active', isApproved: false })).toBe(false);
    expect(canMemberSignIn(null)).toBe(false);
    expect(canMemberSignIn(undefined)).toBe(false);
  });
});
