import { sendEmail } from "./sendemail.js";

export const sendRenterBookingConfirmedEmail = async ({
  renterEmail,
  renterName,
  vehicleModel,
  fromDate,
  fromTime,
  toDate,
  toTime,
  totalPrice,
  hostName,
}) => {
  await sendEmail({
    to: renterEmail,
    subject: "✅ Your RideNow Booking is Confirmed!",
    text: `
Booking Confirmed

Hi ${renterName},

Your booking has been approved by the host.

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}
Host: ${hostName}

Please arrive on time and enjoy your ride!
    `,
    html: `
      <h2 style="text-align:center;margin-top:0;">✅ Booking Confirmed</h2>

      <p>Hi <strong>${renterName}</strong>,</p>

      <p>Your booking has been <strong>approved by the host</strong>.</p>

      <h3>Booking Details</h3>
      <table style="width:100%;font-size:14px;">
        <tr><td><strong>Vehicle:</strong></td><td>${vehicleModel}</td></tr>
        <tr><td><strong>From:</strong></td><td>${fromDate} ${fromTime}</td></tr>
        <tr><td><strong>To:</strong></td><td>${toDate} ${toTime}</td></tr>
        <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
        <tr><td><strong>Host:</strong></td><td>${hostName}</td></tr>
        <tr><td><strong>Phone:</strong></td><td>${hostPhone}</td></tr>
      </table>

      <p style="margin-top:20px;text-align:center;">
        Have a safe and enjoyable ride 🚲
      </p>
    `,
  });
};