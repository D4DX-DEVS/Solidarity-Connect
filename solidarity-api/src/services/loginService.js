import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Member from '../models/Member.js';
import MemberAuth from '../models/MemberAuth.js';
import LoginOtp from '../models/LoginOtp.js';
import msghexService from './msghexService.js';

/**
 * Phone-first sign-in.
 *
 *   1. sendLoginOtp(phone)            → one WhatsApp code for the whole number
 *   2. verifyLoginOtp(phone, code)    → every account on that number + a short-lived ticket
 *   3. selectAccount(ticket, ...)     → a real session token for the chosen account
 *
 * The ticket exists so step 3 cannot be called without having passed step 2, and so
 * switching between a number's accounts never costs a second OTP.
 */

/** Shared demo/QA login. Covers every role so one number can exercise the whole app. */
export const TEST_PHONE = '9876543210';
export const TEST_OTP = '1234';

const TICKET_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

const ROLE_LABELS = {
  state_admin: 'State Admin',
  district_admin: 'District Admin',
  group_admin: 'Area Admin',
  member: 'Member',
};

/**
 * Human label for an account. Murabi and Coordinator admins are the same thing
 * as Area Admin (identical permissions, one login) — everything area-level is
 * labelled "Area Admin"; adminKind is a legacy data field only.
 */
export function accountLabel(role, _adminKind) {
  return ROLE_LABELS[role] || role;
}

/** Bare 10 digits. Accepts +919895123456, 919895123456, 09895123456, 9895123456. */
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * India stays strict (10 digits, 6-9 start). Any other country arrives already
 * country-coded from the sign-in form, so it is checked as plain E.164 digits.
 */
export function isValidPhone(phone) {
  const bare = normalizePhone(phone);
  if (bare.length === 10) return /^[6-9]\d{9}$/.test(bare);
  return /^\d{11,15}$/.test(bare);
}

/** Admin rows store 10-digit or +91-prefixed numbers; members store +91. Match all. */
export function phoneVariants(phone) {
  const bare = normalizePhone(phone);
  // Non-Indian numbers keep their country code; only the +91 aliases are legacy.
  if (bare.length !== 10) return [...new Set([bare, `+${bare}`])];
  return [...new Set([bare, `+91${bare}`, `91${bare}`])];
}

function scopeOf(doc) {
  return [doc.district?.name, doc.group?.name].filter(Boolean).join(' • ') || null;
}

/**
 * Every account reachable from a phone number: each admin User row plus the
 * member profile, if any. Shape is what the account picker renders.
 */
export async function listAccounts(phone) {
  const variants = phoneVariants(phone);

  const users = await User.find({ phone: { $in: variants }, isActive: true })
    .populate('district', 'name code')
    .populate('group', 'name code')
    .lean();

  // Murabi/Coordinator accounts are duplicates of the Area Admin login — same
  // person, same permissions, same group. Show one card per (role, group):
  // prefer the plain 'area' row, else the first found. Legacy rows stay in the
  // DB but are no longer separately signable-in.
  const deduped = [];
  const areaSeen = new Map(); // "group id" -> index in deduped
  for (const user of users) {
    if (user.role === 'group_admin') {
      const key = String(user.group?._id || user.group || '');
      const existingIdx = areaSeen.get(key);
      if (existingIdx !== undefined) {
        if ((user.adminKind || 'area') === 'area') deduped[existingIdx] = user;
        continue;
      }
      areaSeen.set(key, deduped.length);
    }
    deduped.push(user);
  }

  const accounts = deduped.map((user) => ({
    id: String(user._id),
    type: 'admin',
    role: user.role,
    adminKind: user.role === 'group_admin' ? (user.adminKind || 'area') : null,
    label: accountLabel(user.role, user.adminKind),
    name: user.name,
    scope: scopeOf(user),
    lastLogin: user.lastLogin || null,
  }));

  const member = await Member.findOne({
    phone: { $in: variants },
    status: 'Active',
    isApproved: true,
  })
    .populate('district', 'name')
    .populate('group', 'name')
    .lean();

  if (member) {
    accounts.push({
      id: String(member._id),
      type: 'member',
      role: 'member',
      adminKind: null,
      label: ROLE_LABELS.member,
      name: member.name,
      scope: scopeOf(member),
      lastLogin: null,
    });
  }

  // Most privileged first, so the common case is the top card.
  const rank = { state_admin: 0, district_admin: 1, group_admin: 2, member: 3 };
  return accounts.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9));
}

function signTicket(phone) {
  return jwt.sign(
    { phone: normalizePhone(phone), purpose: 'account-select' },
    process.env.JWT_SECRET,
    { expiresIn: TICKET_TTL_SECONDS }
  );
}

/** Throws on a bad/expired/wrong-purpose ticket. Returns the normalized phone. */
export function readTicket(ticket) {
  const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
  if (decoded.purpose !== 'account-select' || !decoded.phone) {
    throw new Error('Invalid login ticket');
  }
  return decoded.phone;
}

/**
 * Step 1 — deliver a code. Refuses unknown numbers so the picker in step 2 is
 * never empty, and rate-limits resends.
 */
export async function sendLoginOtp(phone, { isResend = false } = {}) {
  const bare = normalizePhone(phone);

  if (!isValidPhone(bare)) {
    return { success: false, status: 400, message: 'Enter a valid mobile number.' };
  }

  const accounts = await listAccounts(bare);
  if (accounts.length === 0) {
    return {
      success: false,
      status: 404,
      message: 'This number is not registered. Please contact your administrator.',
    };
  }

  const existing = await LoginOtp.findOne({ phone: bare });
  if (isResend && existing) {
    const wait = existing.resendCooldownRemaining(RESEND_COOLDOWN_SECONDS);
    if (wait > 0) {
      return {
        success: false,
        status: 429,
        message: `Please wait ${wait}s before requesting another code.`,
        retryAfter: wait,
      };
    }
  }

  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // The shared test number skips WhatsApp entirely and always uses a fixed code.
  const isTestPhone = bare === TEST_PHONE;
  let code = TEST_OTP;

  if (!isTestPhone) {
    const delivery = await msghexService.sendOTP(bare, expiryMinutes);
    if (!delivery.success) {
      return {
        success: false,
        status: 502,
        message: 'Could not send the WhatsApp code right now. Please try again shortly.',
        error: delivery.error,
      };
    }
    code = delivery.otp;
  }

  await LoginOtp.findOneAndDelete({ phone: bare });
  await LoginOtp.create({ phone: bare, code, expiresAt, attempts: 0, lastSentAt: new Date() });

  return {
    success: true,
    message: isTestPhone
      ? 'Test number — use code 1234.'
      : 'Verification code sent to your WhatsApp.',
    expiresAt,
    accountsCount: accounts.length,
    isTestPhone,
  };
}

/** Step 2 — check the code, hand back the accounts and a selection ticket. */
export async function verifyLoginOtp(phone, code) {
  const bare = normalizePhone(phone);
  const record = await LoginOtp.findOne({ phone: bare });

  if (!record) {
    return { success: false, status: 400, message: 'No active code. Please request a new one.' };
  }

  if (record.isExpired()) {
    await record.deleteOne();
    return { success: false, status: 400, message: 'This code has expired. Please request a new one.' };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await record.deleteOne();
    return { success: false, status: 429, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  const matches = await record.compareCode(code);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    const left = MAX_OTP_ATTEMPTS - record.attempts;
    return {
      success: false,
      status: 400,
      message: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`,
      attemptsRemaining: left,
    };
  }

  await record.deleteOne();

  const accounts = await listAccounts(bare);
  if (accounts.length === 0) {
    return { success: false, status: 404, message: 'No active accounts found for this number.' };
  }

  return {
    success: true,
    message: 'Verified.',
    accounts,
    ticket: signTicket(bare),
  };
}

function signAdminToken(user) {
  return jwt.sign(
    { id: user._id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
  );
}

function signMemberToken(memberAuth, member) {
  return jwt.sign(
    { id: memberAuth._id, memberId: member._id, phone: memberAuth.phone, userType: 'member' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
  );
}

/**
 * Step 3 — exchange the ticket for a real session on one specific account.
 * The account is re-resolved from the DB and must belong to the ticket's phone,
 * so a tampered accountId cannot cross over to someone else's account.
 */
export async function selectAccount(phone, accountId, accountType) {
  const variants = phoneVariants(phone);

  if (accountType === 'member') {
    const member = await Member.findOne({
      _id: accountId,
      phone: { $in: variants },
      status: 'Active',
      isApproved: true,
    })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      return { success: false, status: 403, message: 'That member account is not available.' };
    }

    let memberAuth = await MemberAuth.findOne({ member: member._id });
    if (!memberAuth) {
      memberAuth = await MemberAuth.createForMember(member._id);
    }
    if (!memberAuth.isActive) {
      return { success: false, status: 403, message: 'This member account is inactive.' };
    }

    memberAuth.lastLogin = new Date();
    await memberAuth.save({ validateModifiedOnly: true });

    return {
      success: true,
      userType: 'member',
      token: signMemberToken(memberAuth, member),
      member: {
        id: member._id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        district: member.district,
        group: member.group,
        status: member.status,
        joinedDate: member.joinedDate,
      },
    };
  }

  const user = await User.findOne({ _id: accountId, phone: { $in: variants }, isActive: true })
    .populate('district', 'name code')
    .populate('group', 'name code district');

  if (!user) {
    return { success: false, status: 403, message: 'That account is not available.' };
  }

  user.lastLogin = new Date();
  await user.save({ validateModifiedOnly: true });

  return {
    success: true,
    userType: user.role,
    token: signAdminToken(user),
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      adminKind: user.role === 'group_admin' ? (user.adminKind || 'area') : null,
      label: accountLabel(user.role, user.adminKind),
      district: user.district,
      group: user.group,
      roleTag: user.roleTag,
      permissions: user.permissions,
      lastLogin: user.lastLogin,
    },
  };
}

export default {
  TEST_PHONE,
  TEST_OTP,
  accountLabel,
  normalizePhone,
  isValidPhone,
  phoneVariants,
  listAccounts,
  readTicket,
  sendLoginOtp,
  verifyLoginOtp,
  selectAccount,
};
