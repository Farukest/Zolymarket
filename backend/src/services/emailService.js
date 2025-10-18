const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      // Configure email transporter based on environment
      if (process.env.EMAIL_SERVICE === 'gmail') {
        this.transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
      } else if (process.env.SMTP_HOST) {
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } else {
        // Use Ethereal for testing
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransporter({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info('Using Ethereal test account for emails');
      }

      // Verify connection
      if (this.transporter) {
        await this.transporter.verify();
        this.initialized = true;
        logger.info('Email service initialized successfully');
      }
    } catch (error) {
      logger.warn('Email service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  // Send welcome email to new users
  async sendWelcomeEmail(userEmail, userName = '') {
    if (!this.initialized) {
      logger.warn('Email service not initialized, skipping welcome email');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Zolymarket FHEVM'}" <${process.env.EMAIL_FROM || 'noreply@zolymarket.com'}>`,
        to: userEmail,
        subject: 'Welcome to Zolymarket FHEVM! 🎉',
        html: this.getWelcomeEmailTemplate(userName),
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${userEmail}`, { messageId: result.messageId });

      return true;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      return false;
    }
  }

  // Send bet resolution notification
  async sendBetResolutionEmail(userEmail, betTitle, isWinner, winnings = 0) {
    if (!this.initialized) {
      logger.warn('Email service not initialized, skipping bet resolution email');
      return false;
    }

    try {
      const subject = isWinner
        ? `🎉 You won! ${betTitle}`
        : `Bet resolved: ${betTitle}`;

      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Zolymarket FHEVM'}" <${process.env.EMAIL_FROM || 'noreply@zolymarket.com'}>`,
        to: userEmail,
        subject,
        html: this.getBetResolutionEmailTemplate(betTitle, isWinner, winnings),
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Bet resolution email sent to ${userEmail}`, { messageId: result.messageId });

      return true;
    } catch (error) {
      logger.error('Failed to send bet resolution email:', error);
      return false;
    }
  }

  // Send admin notification
  async sendAdminNotification(subject, content, priority = 'normal') {
    if (!this.initialized) {
      logger.warn('Email service not initialized, skipping admin notification');
      return false;
    }

    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(',') : [];

    if (adminEmails.length === 0) {
      logger.warn('No admin emails configured');
      return false;
    }

    try {
      const priorityPrefix = priority === 'high' ? '[URGENT] ' : '';

      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Zolymarket FHEVM'}" <${process.env.EMAIL_FROM || 'noreply@zolymarket.com'}>`,
        to: adminEmails,
        subject: `${priorityPrefix}${subject}`,
        html: this.getAdminNotificationTemplate(subject, content, priority),
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Admin notification sent: ${subject}`, { messageId: result.messageId });

      return true;
    } catch (error) {
      logger.error('Failed to send admin notification:', error);
      return false;
    }
  }

  // Send system alert
  async sendSystemAlert(alertType, message, details = {}) {
    return this.sendAdminNotification(
      `System Alert: ${alertType}`,
      `
        <h3>System Alert</h3>
        <p><strong>Type:</strong> ${alertType}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        
        ${Object.keys(details).length > 0 ? `
          <h4>Details:</h4>
          <ul>
            ${Object.entries(details).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
          </ul>
        ` : ''}
      `,
      'high',
    );
  }

  // Email templates
  getWelcomeEmailTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Zolymarket FHEVM</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border-radius: 8px; }
          .content { padding: 20px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Zolymarket FHEVM!</h1>
            <p>The future of private prediction markets</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userName || 'Trader'}! 👋</h2>
            
            <p>Welcome to the world's first prediction market powered by Fully Homomorphic Encryption (FHE). Your betting amounts and positions are completely private while market outcomes remain transparent.</p>
            
            <h3>🔐 What makes us special:</h3>
            <ul>
              <li><strong>Private Betting:</strong> Your bet amounts are encrypted and private</li>
              <li><strong>Transparent Outcomes:</strong> Market results are public and verifiable</li>
              <li><strong>Instant Settlement:</strong> Smart contracts handle payouts automatically</li>
              <li><strong>Fair Markets:</strong> Real-time odds based on collective sentiment</li>
            </ul>
            
            <p>Ready to start betting? Explore our markets and place your first bet!</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">
              Start Trading 🚀
            </a>
          </div>
          
          <div class="footer">
            <p>Powered by FHEVM | Built with privacy in mind</p>
            <p>If you have any questions, feel free to reach out to our team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getBetResolutionEmailTemplate(betTitle, isWinner, winnings) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bet Resolved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: ${isWinner ? '#10b981' : '#6b7280'}; color: white; border-radius: 8px; }
          .content { padding: 20px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
          .winner { background: #dcfce7; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; }
          .loser { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isWinner ? '🎉 Congratulations!' : '📊 Bet Resolved'}</h1>
            <p>${betTitle}</p>
          </div>
          
          <div class="content">
            ${isWinner ? `
              <div class="winner">
                <h3>🏆 You Won!</h3>
                <p>Congratulations! Your bet was successful.</p>
                ${winnings > 0 ? `<p><strong>Your winnings: $${winnings.toFixed(2)}</strong></p>` : ''}
                <p>Your winnings are ready to be claimed!</p>
              </div>
            ` : `
              <div class="loser">
                <h3>📈 Market Resolved</h3>
                <p>The market has been resolved. Unfortunately, your prediction didn't win this time.</p>
                <p>Don't worry - there are always new opportunities in our markets!</p>
              </div>
            `}
            
            <p>Thank you for participating in our prediction market. ${isWinner ? 'Claim your winnings' : 'Explore new markets'} on our platform!</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">
              ${isWinner ? 'Claim Winnings' : 'Explore Markets'} 
            </a>
          </div>
          
          <div class="footer">
            <p>Zolymarket FHEVM - Private Prediction Markets</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAdminNotificationTemplate(subject, content, priority) {
    const priorityColor = priority === 'high' ? '#ef4444' : '#2563eb';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admin Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: ${priorityColor}; color: white; border-radius: 8px; }
          .content { padding: 20px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Admin Notification</h1>
            <p>${subject}</p>
          </div>
          
          <div class="content">
            ${content}
          </div>
          
          <div class="footer">
            <p>Zolymarket FHEVM Admin System</p>
            <p>Time: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      service: process.env.EMAIL_SERVICE || 'Not configured',
      fromEmail: process.env.EMAIL_FROM || 'Not configured',
    };
  }

  // Test email configuration
  async testEmail(testEmail) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Zolymarket FHEVM'}" <${process.env.EMAIL_FROM || 'noreply@zolymarket.com'}>`,
        to: testEmail,
        subject: 'Test Email - Zolymarket FHEVM',
        html: `
          <h2>Email Test Successful! ✅</h2>
          <p>This is a test email from Zolymarket FHEVM.</p>
          <p>Time: ${new Date().toISOString()}</p>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Test email sent to ${testEmail}`, { messageId: result.messageId });

      return {
        success: true,
        messageId: result.messageId,
        previewUrl: nodemailer.getTestMessageUrl(result),
      };
    } catch (error) {
      logger.error('Test email failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = { emailService };
