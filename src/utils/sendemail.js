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

const logoUrl = "https://ridenow.website/temp/logo.png"; 
// ⬆️ use /email-assets as discussed (NOT /temp)

const websiteUrl = "https://ridenow.website";

const wrapWithBaseTemplate = (innerHtml = "") => {
  return `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">

      <!-- Logo -->
      <div style="text-align:center;padding:20px 0;">
        <img src="${logoUrl}" alt="RideNow Logo" style="height:70px;" />
      </div>

      <!-- Card -->
      <div style="background:#f9f9f9;padding:24px;border-radius:12px;">
        ${innerHtml}

        <p style="margin-top:22px;text-align:center;">
          🌐 Visit RideNow<br />
          <a href="${websiteUrl}"
             target="_blank"
             style="
               color:#16a34a;
               text-decoration:none;
               font-weight:600;
               font-size:15px;
             ">
            ridenow.website
          </a>
        </p>
      </div>

      <!-- Footer -->
      <p style="text-align:center;font-size:12px;color:#888;margin-top:15px;">
        © ${new Date().getFullYear()} RideNow
      </p>

    </div>
  `;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const finalHtml = wrapWithBaseTemplate(html);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      text,
      html: finalHtml,
    });

    console.log("📧 Email sent to:", to);
  } catch (error) {
    console.error("❌ Resend email error:", error);
    throw error;
  }
};