import axios from 'axios';

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[character]));

export const sendOtpEmail = async (toEmail, toName, code, purpose) => {
  const subject =
    purpose === 'reset_password' ? 'Sudha Setu password reset code' : 'Verify your Sudha Setu account';

  const body = `<p>Hi ${escapeHtml(toName)},</p><p>Your code is: <strong>${escapeHtml(code)}</strong></p><p>This code expires in 10 minutes.</p>`;

  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { email: process.env.EMAIL_USER, name: 'Sudha Setu' },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent: body,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
  } catch (err) {
    console.warn(
      `[emailService] Failed to send OTP email to ${toEmail}: ${err.message}`
    );
  }
};

