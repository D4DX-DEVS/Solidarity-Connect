import mongoose from 'mongoose';

/**
 * Failed date-of-birth sign-ins per phone number. A date of birth is guessable,
 * so a number is locked for a while after a few wrong tries (loginService).
 * Mongo's TTL monitor drops a row once its window has passed.
 */
const loginAttemptSchema = new mongoose.Schema({
  // Bare digits (normalizePhone), so +91 / 91 / 0-prefixed inputs share one row.
  phone: { type: String, required: true, unique: true },
  failures: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  // The row is forgotten after this — a fresh count starts.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, {
  timestamps: true,
});

export default mongoose.model('LoginAttempt', loginAttemptSchema);
