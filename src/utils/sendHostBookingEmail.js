import { sendEmail } from "./sendemail.js";

export const sendHostBookingEmail = async ({
  hostEmail,
  hostName,
  renterName,
  renterEmail,
  renterPhone,
  vehicleModel,
  fromDate,
  fromTime,
  toDate,
  toTime,
  totalPrice,
}) => {
  const logoUrl = "https://ridenow.website/temp/logo.png";

  await sendEmail({
    to: hostEmail,
    subject: "🚲 New Booking Request on RideNow",
    text: `
RideNow - New Booking Request

Host: ${hostName}

Renter Name: ${renterName}
Renter Email: ${renterEmail}
Renter Phone: ${renterPhone}

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}

Please login to RideNow to approve or reject this booking.

— RideNow Team
    `,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">

        <!-- Logo (NOT clickable) -->
        <div style="text-align:center;padding:20px 0;">
          <img src="${logoUrl}" alt="RideNow Logo" style="height:70px;" />
        </div>

        <!-- Card -->
        <div style="background:#f9f9f9;padding:24px;border-radius:12px;">
          <h2 style="text-align:center;margin-top:0;">🚲 New Booking Request</h2>

          <p>Hi <strong>${hostName}</strong>,</p>

          <p>You have received a new booking request.</p>

          <h3>Renter Details</h3>
          <table style="width:100%;font-size:14px;">
            <tr><td><strong>Name:</strong></td><td>${renterName}</td></tr>
            <tr><td><strong>Email:</strong></td><td>${renterEmail}</td></tr>
            <tr><td><strong>Phone:</strong></td><td>${renterPhone}</td></tr>
          </table>

          <h3 style="margin-top:20px;">Booking Details</h3>
          <table style="width:100%;font-size:14px;">
            <tr><td><strong>Vehicle:</strong></td><td>${vehicleModel}</td></tr>
            <tr><td><strong>From:</strong></td><td>${fromDate} ${fromTime}</td></tr>
            <tr><td><strong>To:</strong></td><td>${toDate} ${toTime}</td></tr>
            <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
            <tr><td><strong>Status:</strong></td><td>Pending Approval</td></tr>
          </table>

          <p style="margin-top:20px;text-align:center;">
            Please login to your RideNow dashboard to approve or reject this booking.
          </p>
        </div>

        <p style="text-align:center;font-size:12px;color:#888;margin-top:15px;">
          © ${new Date().getFullYear()} RideNow
        </p>

      </div>
    `,
  });
};