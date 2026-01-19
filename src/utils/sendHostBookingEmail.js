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
  await sendEmail({
    to: hostEmail,
    subject: "🚲 New Booking Request on RideNow",
    text: `
New Booking Request

Host: ${hostName}

Renter Name: ${renterName}
Renter Email: ${renterEmail}
Renter Phone: ${renterPhone}

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}

Please login to RideNow to approve or reject this booking.
    `,
    html: `
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
    `,
  });
};