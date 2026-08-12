import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Phone-keyed login OTP for the account-picker sign-in flow.
 *
 * The legacy flow stored the OTP on the User document, which forced the caller to
 * pick a role *before* any code could be sent. Sign-in is now phone-first — one code
 * unlocks every account on that number — so the code has to live somewhere that is
 * not tied to a single role, and that works for member-only numbers with no User doc.
 *
 * Mongo's TTL monitor sweeps expired docs; `isExpired()` is still the authority
 * because that sweep only runs about once a minute.
 */
const loginOtpSchema = new mongoose.Schema({
  // Normalized to bare 10 digits so +91 / 91 / 0-prefixed inputs all collide correctly.
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Phone must be a 10-digit Indian mobile number']
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    // expireAfterSeconds: 0 → delete the doc once `expiresAt` passes.
    index: { expires: 0 }
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

loginOtpSchema.pre('save', async function hashCode(next) {
  if (!this.isModified('code')) return next();
  this.code = await bcrypt.hash(this.code, 10);
  next();
});

loginOtpSchema.methods.compareCode = function compareCode(candidate) {
  return bcrypt.compare(String(candidate), this.code);
};

loginOtpSchema.methods.isExpired = function isExpired() {
  return !this.expiresAt || this.expiresAt < new Date();
};

/** Seconds still to wait before a resend is allowed (0 when it is allowed now). */
loginOtpSchema.methods.resendCooldownRemaining = function resendCooldownRemaining(cooldownSeconds) {
  if (!this.lastSentAt) return 0;
  const elapsed = (Date.now() - this.lastSentAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
};

export default mongoose.model('LoginOtp', loginOtpSchema);
