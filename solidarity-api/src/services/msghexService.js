import axios from 'axios';
import { randomInt } from 'node:crypto';

/**
 * Length of every login code we issue. The login UI renders exactly this many boxes
 * and POST /auth/login/verify-otp validates exactly this many digits, so changing it
 * here means changing it there too — see OTP_LENGTH in src/pages/Login.tsx.
 */
export const OTP_DIGITS = 4;

const OTP_MESSAGE_TEMPLATE =
  'Your SOLIDARITY login code is {{otp}}.\n\nValid for {{minutes}} minutes. Do not share this code with anyone.\n\n- Solidarity Team';

/**
 * MsgHex WhatsApp gateway (https://msghex.com/dashboard/settings/developers).
 * Sole WhatsApp provider for this app — OTP delivery and notification broadcasts.
 *
 * Primary OTP path is POST /api/send/otp — MsgHex generates the code, substitutes it
 * into the {{otp}} placeholder, and returns it in the response. We take that code
 * as the code of record and hash/expire it ourselves, so expiry and attempt limits
 * stay under our control and we never call their /api/get/otp verify endpoint.
 *
 * ponytail: falls back to the plain text endpoint with a locally generated code if
 * the OTP endpoint is unavailable. Upgrade path if delivery gets flaky: queue sends
 * and retry, rather than adding a second provider.
 */
class MsgHexService {
  getConfig() {
    return {
      baseUrl: this.resolveBaseUrl(process.env.MSGHEX_API_URL),
      secret: process.env.MSGHEX_API_SECRET,
      account: process.env.MSGHEX_ACCOUNT_ID,
    };
  }

  /**
   * MSGHEX_API_URL is meant to be an origin, but a full endpoint URL is the natural
   * thing to paste out of the docs — and appending our own path to that yields a 404
   * that looks like a credentials problem. Keep only the origin.
   */
  resolveBaseUrl(configured) {
    const raw = (configured || '').trim() || 'https://api.msghex.com';
    try {
      return new URL(raw).origin;
    } catch {
      return raw.replace(/\/+$/, '');
    }
  }

  isConfigured() {
    const { secret, account } = this.getConfig();
    return Boolean(secret && account);
  }

  /** MsgHex wants a bare country-coded number: 919895123456 */
  formatRecipient(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  }

  // crypto.randomInt, not Math.random — a login code from a predictable PRNG is
  // guessable, and this one is the only thing standing between a phone number and
  // every account on it.
  generateOTP() {
    const min = 10 ** (OTP_DIGITS - 1);
    return randomInt(min, min * 10).toString();
  }

  /**
   * Sends a login code over WhatsApp.
   * @returns {Promise<{success: boolean, otp?: string, messageId?: string, error?: string}>}
   *          `otp` is the code that was delivered — store this one.
   *
   * We generate the code ourselves and send it as a normal message rather than using
   * MsgHex's POST /api/send/otp. That endpoint mints its own code, it is 6 digits, and
   * there is no length parameter — so it silently delivers a code the UI has no room
   * for. Owning the code keeps length, expiry and attempt limits in one place.
   */
  async sendOTP(phone, expiryMinutes = 10) {
    if (!this.isConfigured()) {
      return { success: false, error: 'MsgHex API not configured (MSGHEX_API_SECRET / MSGHEX_ACCOUNT_ID)' };
    }

    return this.sendOTPAsText(phone, this.generateOTP(), expiryMinutes);
  }

  /** Deliver a code we generated ourselves as a plain WhatsApp text. */
  async sendOTPAsText(phone, otp, expiryMinutes, previousError) {
    const message = OTP_MESSAGE_TEMPLATE
      .replace('{{otp}}', otp)
      .replace('{{minutes}}', String(expiryMinutes));

    const result = await this.sendWhatsAppMessage(phone, message);
    return result.success
      ? { success: true, otp, messageId: result.messageId }
      : { success: false, error: result.error || previousError };
  }

  async sendWhatsAppMessage(phone, message) {
    const { baseUrl, secret, account } = this.getConfig();

    if (!this.isConfigured()) {
      return { success: false, error: 'MsgHex API not configured' };
    }

    try {
      const { data } = await axios.post(
        `${baseUrl}/api/send/whatsapp`,
        { secret, account, recipient: this.formatRecipient(phone), type: 'text', message },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      if (data?.status !== 200) {
        throw new Error(data?.message || 'MsgHex send failed');
      }

      return { success: true, messageId: data?.data?.messageId, status: 'sent' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: 'failed',
      };
    }
  }

  /**
   * Broadcast to many recipients via MsgHex's campaign queue.
   * Returns one result row per recipient so callers can report per-number failures.
   */
  async sendBulkWhatsAppMessages(recipients) {
    const { baseUrl, secret, account } = this.getConfig();

    if (!this.isConfigured()) {
      return recipients.map((r) => ({ phone: r.phone, success: false, error: 'MsgHex API not configured' }));
    }

    // Group by identical message so each distinct body becomes one campaign.
    const byMessage = new Map();
    for (const recipient of recipients) {
      const list = byMessage.get(recipient.message) || [];
      list.push(recipient.phone);
      byMessage.set(recipient.message, list);
    }

    const results = [];
    for (const [message, phones] of byMessage) {
      try {
        const { data } = await axios.post(
          `${baseUrl}/api/send/whatsapp/bulk`,
          {
            secret,
            account,
            recipients: phones.map((p) => this.formatRecipient(p)).join(','),
            type: 'text',
            message,
            campaign: `solidarity-${Date.now()}`,
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
        );

        if (data?.status !== 200) {
          throw new Error(data?.message || 'MsgHex bulk send failed');
        }

        results.push(...phones.map((phone) => ({ phone, success: true, status: 'queued' })));
      } catch (error) {
        const message_ = error.response?.data?.message || error.message;
        results.push(...phones.map((phone) => ({ phone, success: false, error: message_, status: 'failed' })));
      }
    }

    return results;
  }

  /** Notification broadcast formatting, kept here so callers stay template-free. */
  async sendNotificationMessage(phone, title, message, type = 'general') {
    const prefix = {
      meeting: `📅 *${title}*`,
      urgent: `🚨 *URGENT: ${title}*`,
      reminder: `⏰ *Reminder: ${title}*`,
      announcement: `📢 *${title}*`,
    }[type] || `*${title}*`;

    return this.sendWhatsAppMessage(phone, `${prefix}\n\n${message}\n\n- Solidarity Team`);
  }
}

export default new MsgHexService();
