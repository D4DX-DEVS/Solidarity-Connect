import axios from 'axios';

class DXingService {
  constructor() {
    // Initialize credentials lazily to avoid warnings during startup
  }

  // Get credentials when needed
  getCredentials() {
    if (!this.apiUrl) {
      this.apiUrl = process.env.DXING_API_URL;
      this.apiSecret = process.env.DXING_API_SECRET;
      this.accountId = process.env.DXING_ACCOUNT_ID;
    }
    return {
      apiUrl: this.apiUrl,
      apiSecret: this.apiSecret,
      accountId: this.accountId
    };
  }

  // Check if credentials are configured
  isConfigured() {
    const { apiUrl, apiSecret, accountId } = this.getCredentials();
    return !!(apiUrl && apiSecret && accountId);
  }

  // Send WhatsApp message
  async sendWhatsAppMessage(phone, message, options = {}) {
    try {
      // In development mode, simulate successful sending
      if (process.env.NODE_ENV === 'development' && process.env.DXING_MOCK_MODE === 'true') {
        console.log('\n🚀 ===============================');
        console.log('📱 MOCK WhatsApp Message');
        console.log('===============================');
        console.log(`📞 To: ${phone}`);
        console.log(`📝 Message: ${message}`);
        console.log('===============================\n');
        
        return {
          success: true,
          messageId: 'mock_' + Date.now(),
          status: 'sent',
          data: { mock: true, phone, message: 'Message sent in mock mode' }
        };
      }

      if (!this.isConfigured()) {
        console.warn('DXing API credentials not configured properly');
        throw new Error('DXing API not configured');
      }

      const { apiUrl, apiSecret, accountId } = this.getCredentials();

      // Format phone number according to DXing format (add 91 country code)
      let formattedPhone = phone;
      if (phone.startsWith('+91')) {
        formattedPhone = phone.substring(1); // Remove + but keep 91
      } else if (phone.startsWith('91') && phone.length === 12) {
        formattedPhone = phone; // Already has 91
      } else if (phone.length === 10) {
        formattedPhone = '91' + phone; // Add 91 prefix
      } else if (phone.startsWith('0') && phone.length === 11) {
        formattedPhone = '91' + phone.substring(1); // Remove leading 0 and add 91
      }
      
      // DXing API payload format (based on documentation example)
      const payload = {
        secret: apiSecret,
        account: accountId,
        recipient: formattedPhone,
        type: 'text',
        message: message,
        priority: options.priority === 'high' ? 1 : 0
      };

      console.log('Sending DXing request:', { 
        url: apiUrl, 
        payload: {
          ...payload,
          message: message.substring(0, 50) + '...'
        }
      });

      // Send as JSON payload
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      });

      console.log('DXing response:', response.data);

      // Check if the response indicates success
      if (response.data.status !== 200 && response.data.status !== 'success') {
        // Handle specific error cases
        if (response.data.status === 404 && response.data.message.includes("WhatsApp account doesn't exist")) {
          throw new Error(`WhatsApp number not found: ${formattedPhone}. Please ensure the number is registered with WhatsApp.`);
        } else if (response.data.status === 400) {
          throw new Error(`DXing API Error: ${response.data.message}`);
        } else {
          throw new Error(`DXing API Error (${response.data.status}): ${response.data.message}`);
        }
      }

      return {
        success: true,
        messageId: response.data.message_id || response.data.id || response.data.messageId,
        status: response.data.status || 'sent',
        data: response.data
      };

    } catch (error) {
      console.error('DXing WhatsApp send error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || error.message,
        status: 'failed',
        details: error.response?.data
      };
    }
  }

  // Send OTP via WhatsApp
  async sendOTP(phone, otp) {
    const message = `🔐 Your Solidarity login OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share this code with anyone.\n\n- Solidarity Team`;
    
    return this.sendWhatsAppMessage(phone, message, {
      type: 'text',
      priority: 'high'
    });
  }

  // Send bulk WhatsApp messages
  async sendBulkWhatsAppMessages(recipients) {
    const results = [];
    
    // Process in batches to avoid rate limiting
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (recipient) => {
        const result = await this.sendWhatsAppMessage(
          recipient.phone, 
          recipient.message, 
          recipient.options || {}
        );
        
        return {
          phone: recipient.phone,
          ...result
        };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            phone: batch[index].phone,
            success: false,
            error: result.reason.message,
            status: 'failed'
          });
        }
      });

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }

  // Get message status
  async getMessageStatus(messageId) {
    try {
      if (!this.isConfigured()) {
        throw new Error('DXing API not configured');
      }

      const { apiUrl, apiSecret } = this.getCredentials();

      const response = await axios.get(`${apiUrl}/status/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${apiSecret}`,
          'Accept': 'application/json'
        }
      });

      return {
        success: true,
        status: response.data.status,
        data: response.data
      };

    } catch (error) {
      console.error('DXing status check error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Send notification with template
  async sendNotificationMessage(phone, title, message, type = 'general') {
    let formattedMessage = '';
    
    switch (type) {
      case 'meeting':
        formattedMessage = `📅 *${title}*\n\n${message}\n\n- Solidarity Team`;
        break;
      case 'urgent':
        formattedMessage = `🚨 *URGENT: ${title}*\n\n${message}\n\n- Solidarity Team`;
        break;
      case 'reminder':
        formattedMessage = `⏰ *Reminder: ${title}*\n\n${message}\n\n- Solidarity Team`;
        break;
      case 'announcement':
        formattedMessage = `📢 *${title}*\n\n${message}\n\n- Solidarity Team`;
        break;
      default:
        formattedMessage = `*${title}*\n\n${message}\n\n- Solidarity Team`;
    }

    return this.sendWhatsAppMessage(phone, formattedMessage, {
      type: 'text',
      priority: type === 'urgent' ? 'high' : 'normal'
    });
  }

  // Validate phone number format
  isValidPhoneNumber(phone) {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  // Format phone number for DXing API
  formatPhoneNumber(phone) {
    // Remove any spaces, dashes, or other characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 91, add +
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    
    // If it's 10 digits, add +91
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }
    
    // If it already has +91
    if (phone.startsWith('+91')) {
      return phone;
    }
    
    return phone; // Return as is if format is unclear
  }

  // Test API connection
  async testConnection() {
    try {
      // Try to send a test message to a dummy number (this will fail but test the API)
      const result = await this.sendWhatsAppMessage('+919999999999', 'Test connection');
      return {
        success: true,
        message: 'DXing API connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: 'DXing API connection failed',
        error: error.message
      };
    }
  }
}

export default new DXingService();