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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f5f7;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 540px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e4e8;
          }
          .header {
            background-color: #1e3a8a;
            padding: 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 20px;
            font-weight: 600;
          }
          .body {
            padding: 30px;
            color: #24292e;
            line-height: 1.5;
          }
          .body p {
            margin: 0 0 16px;
            font-size: 15px;
          }
          .otp-container {
            text-align: center;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: 700;
            color: #1e3a8a;
            letter-spacing: 6px;
            background-color: #f1f5f9;
            padding: 12px 24px;
            display: inline-block;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
          }
          .footer {
            background-color: #fafbfc;
            padding: 16px 30px;
            text-align: center;
            border-top: 1px solid #e1e4e8;
          }
          .footer p {
            margin: 0;
            font-size: 12px;
            color: #586069;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SurakshaAI Safety Portal</h1>
          </div>
          <div class="body">
            <p>Hello,</p>
            <p>Use the verification code below to complete your login request for the SurakshaAI Safety Portal.</p>
            <div class="otp-container">
              <div class="otp-code">${otp}</div>
            </div>
            <p>This verification code is valid for 5 minutes and can only be used once.</p>
            <p>If you did not request this code, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from SurakshaAI Portal.</p>
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
      subject: `SurakshaAI Verification Code: ${otp}`,
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
