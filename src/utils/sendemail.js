// utils/sendEmail.js
/*import nodemailer from "nodemailer";

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
      from: `"RideNow" <${process.env.EMAIL_USER}>`,
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
};*/
// utils/sendNotification.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      text,
      html,
    });

    console.log("📧 Email sent to:", to);
  } catch (error) {
    console.error("❌ Resend email error:", error);
    throw error;
  }
};