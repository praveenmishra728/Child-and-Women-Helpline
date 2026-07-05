/**
 * email.service.js
 * Service for managing transactional emails (OTP delivery) using Resend.
 */

const resend = require('../config/resend');
const config = require('../config/config');

/**
 * Send validation OTP code via Resend
 * @param {string} to - Destination email address
 * @param {string} otp - Unhashed 6-digit verification code
 * @returns {Promise<object>} Resend response object
 */
const sendOtpEmail = async (to, otp) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SurakshaAI Verification Code</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
          }
          .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid #eef2f6;
          }
          .email-header {
            background: linear-gradient(135deg, #d9383a 0%, #9a1f21 100%);
            padding: 30px;
            text-align: center;
          }
          .email-header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .email-body {
            padding: 40px 30px;
            color: #333333;
            line-height: 1.6;
          }
          .email-body p {
            margin-top: 0;
            margin-bottom: 20px;
            font-size: 16px;
          }
          .otp-card {
            background-color: #fcf1f1;
            border: 1px dashed #d9383a;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: 700;
            color: #d9383a;
            letter-spacing: 8px;
            margin: 0;
          }
          .info-text {
            font-size: 14px;
            color: #666666;
            background-color: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 30px;
          }
          .email-footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #eef2f6;
          }
          .email-footer p {
            margin: 0;
            font-size: 12px;
            color: #999999;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <!-- Project Logo Placeholder -->
            <div style="font-size: 28px; margin-bottom: 10px;">🛡️</div>
            <h1>SurakshaAI Portal</h1>
          </div>
          <div class="email-body">
            <p>Hello,</p>
            <p>You requested a secure verification code to log in to the <strong>SurakshaAI Women & Child Safety Portal</strong>. Please use the 6-digit One-Time Password (OTP) below to authenticate your identity.</p>
            
            <div class="otp-card">
              <div class="otp-code">${otp}</div>
            </div>
            
            <div class="info-text">
              ⚠️ <strong>This OTP is valid for exactly 5 minutes</strong> and can only be used once. For security reasons, do not share this code with anyone, including police personnel or administrators.
            </div>
            
            <p>If you did not request this verification code, please ignore this email or contact support if you suspect unauthorized access.</p>
          </div>
          <div class="email-footer">
            <p>This is an automated security system notification from SurakshaAI Portal.</p>
            <p style="margin-top: 5px;">&copy; 2026 SurakshaAI Safety, Department of Police Training.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resend) {
      console.log(`[Email Mock Service] Sending OTP: ${otp} to ${to}`);
      return { id: 'mock-email-id', success: true };
    }

    const { data, error } = await resend.emails.send({
      from: config.resend.fromEmail,
      to: [to],
      subject: `Your Secure OTP: ${otp} - SurakshaAI Portal`,
      html: htmlContent
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('[Email Service Error] Failed to send OTP:', error.message);
    throw error;
  }
};

module.exports = {
  sendOtpEmail
};
