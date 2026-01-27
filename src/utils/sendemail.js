// utils/sendNotification.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ MUST be publicly accessible image (PNG/JPG preferred)
const logoUrl = "https://ridenow.website/email-assets/logo.png";
const websiteUrl = "https://ridenow.website";

const wrapWithBaseTemplate = (innerHtml = "") => {
  return `
  <div style="max-width:600px;margin:auto;font-family:Arial,Helvetica,sans-serif;color:#333;background:#ffffff;">

    <!-- Logo -->
    <div style="text-align:center;padding:20px 0;">
      <img
        src="${logoUrl}"
        alt="RideNow"
        width="140"
        style="
          display:block;
          margin:0 auto;
          max-width:140px;
          height:auto;
        "
      />
    </div>

    <!-- Content Card -->
    <div style="background:#f9f9f9;padding:24px;border-radius:12px;">
      ${innerHtml}

      <p style="margin-top:24px;text-align:center;">
        🌐 Visit RideNow<br />
        <a
          href="${websiteUrl}"
          target="_blank"
          style="
            color:#16a34a;
            text-decoration:none;
            font-weight:600;
            font-size:15px;
          "
        >
          ridenow.website
        </a>
      </p>
    </div>

    <!-- Support -->
    <div style="text-align:center;margin-top:20px;font-size:13px;color:#555;">
      <p style="margin-bottom:6px;font-weight:600;">
        📞 Need Help or Support?
      </p>
      <p style="margin:0;">
        Contact us at <strong>8707230485</strong> or <strong>6387634132</strong>
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#888;margin-top:16px;">
      © ${new Date().getFullYear()} RideNow. All rights reserved.
    </p>

  </div>
  `;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const finalHtml = wrapWithBaseTemplate(html);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL, // e.g. RideNow <no-reply@ridenow.website>
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