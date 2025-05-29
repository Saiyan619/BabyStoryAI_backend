const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: {
        user: process.env.EMAIL_USER, // Add to .env
        pass: process.env.EMAIL_PASS, // Add to .env
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('Email error:', error.message);
    throw new Error('Failed to send email');
  }
};

module.exports = sendEmail;