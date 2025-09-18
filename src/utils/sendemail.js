// utils/sendEmail.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"MoviePie" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: message,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(" Email sent:", result.messageId);
    return result;
  } catch (error) {
    console.error(" Email sending failed:", error.message);
    throw error;
  }
};