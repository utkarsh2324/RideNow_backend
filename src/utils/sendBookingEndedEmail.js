import { sendEmail } from "./sendemail.js";

export const sendBookingEndedEmail = async ({
  renterEmail,
  renterName,
  hostEmail,
  hostName,
  vehicleModel,
  fromDate,
  toDate,
  totalPrice,
  autoEnded,
}) => {
  const logoUrl = "https://ridenow.website/temp/logo.png";
  const websiteUrl = "https://ridenow.website";

  const statusText = autoEnded
    ? "Automatically ended (booking time completed)"
    : "Ended manually by renter";

  /* ---------- EMAIL TO RENTER ---------- */
  if (renterEmail) {
    await sendEmail({
      to: renterEmail,
      subject: "🏁 Your RideNow Booking Has Ended",
      text: `
RideNow - Booking Completed

Hi ${renterName},

Your booking for ${vehicleModel} has ended.

From: ${fromDate}
To: ${toDate}
Total Price: ₹${totalPrice}
Status: ${statusText}

Visit: ${websiteUrl}

— RideNow Team
      `,
      html: `
        <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">

          <!-- Logo -->
          <div style="text-align:center;padding:20px 0;">
            <img src="${logoUrl}" alt="RideNow Logo" style="height:70px;" />
          </div>

          <!-- Content Card -->
          <div style="background:#f9f9f9;padding:24px;border-radius:12px;">
            <h2 style="text-align:center;margin-top:0;">🏁 Booking Completed</h2>

            <p>Hi <strong>${renterName}</strong>,</p>

            <p>Your booking for <strong>${vehicleModel}</strong> has ended.</p>

            <table style="width:100%;margin-top:15px;font-size:14px;">
              <tr><td><strong>From:</strong></td><td>${fromDate}</td></tr>
              <tr><td><strong>To:</strong></td><td>${toDate}</td></tr>
              <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
              <tr><td><strong>Status:</strong></td><td>${statusText}</td></tr>
            </table>

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

            <p style="margin-top:20px;text-align:center;">
              Thank you for choosing <strong>RideNow</strong> 🚲
            </p>
          </div>

          <p style="text-align:center;font-size:12px;color:#888;margin-top:15px;">
            © ${new Date().getFullYear()} RideNow
          </p>
        </div>
      `,
    });
  }

  /* ---------- EMAIL TO HOST ---------- */
  if (hostEmail) {
    await sendEmail({
      to: hostEmail,
      subject: "🏁 RideNow Booking Completed",
      text: `
RideNow - Booking Completed

Hi ${hostName},

A booking for your vehicle has been completed.

Vehicle: ${vehicleModel}
Renter: ${renterName}
From: ${fromDate}
To: ${toDate}
Total Price: ₹${totalPrice}
Status: ${statusText}

Visit: ${websiteUrl}

— RideNow Team
      `,
      html: `
        <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">

          <!-- Logo -->
          <div style="text-align:center;padding:20px 0;">
            <img src="${logoUrl}" alt="RideNow Logo" style="height:70px;" />
          </div>

          <!-- Content Card -->
          <div style="background:#f9f9f9;padding:24px;border-radius:12px;">
            <h2 style="text-align:center;margin-top:0;">🏁 Booking Completed</h2>

            <p>Hi <strong>${hostName}</strong>,</p>

            <p>A booking for your vehicle has been successfully completed.</p>

            <table style="width:100%;margin-top:15px;font-size:14px;">
              <tr><td><strong>Vehicle:</strong></td><td>${vehicleModel}</td></tr>
              <tr><td><strong>Renter:</strong></td><td>${renterName}</td></tr>
              <tr><td><strong>From:</strong></td><td>${fromDate}</td></tr>
              <tr><td><strong>To:</strong></td><td>${toDate}</td></tr>
              <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
              <tr><td><strong>Status:</strong></td><td>${statusText}</td></tr>
            </table>

            <p style="margin-top:22px;text-align:center;">
              🌐 RideNow Platform<br />
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

          <p style="text-align:center;font-size:12px;color:#888;margin-top:15px;">
            © ${new Date().getFullYear()} RideNow
          </p>
        </div>
      `,
    });
  }
};