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
  const statusText = autoEnded
    ? "Automatically ended (booking time completed)"
    : "Ended manually by renter";

  if (renterEmail) {
    await sendEmail({
      to: renterEmail,
      subject: "Your RideNow Booking Has Ended",
      text: `
Booking Completed

Vehicle: ${vehicleModel}
From: ${fromDate}
To: ${toDate}
Total Price: ₹${totalPrice}
Status: ${statusText}
      `,
      html: `
        <h2 style="text-align:center;"> Booking Completed</h2>

        <p>Hi <strong>${renterName}</strong>,</p>

        <p>Your booking for <strong>${vehicleModel}</strong> has ended.</p>

        <table style="width:100%;font-size:14px;">
          <tr><td><strong>From:</strong></td><td>${fromDate}</td></tr>
          <tr><td><strong>To:</strong></td><td>${toDate}</td></tr>
          <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
          <tr><td><strong>Status:</strong></td><td>${statusText}</td></tr>
        </table>
      `,
    });
  }

  if (hostEmail) {
    await sendEmail({
      to: hostEmail,
      subject: " RideNow Booking Completed",
      text: `
Booking Completed

Vehicle: ${vehicleModel}
Renter: ${renterName}
From: ${fromDate}
To: ${toDate}
Total Price: ₹${totalPrice}
Status: ${statusText}
      `,
      html: `
        <h2 style="text-align:center;"> Booking Completed</h2>

        <p>Hi <strong>${hostName}</strong>,</p>

        <p>A booking for your vehicle has been completed.</p>

        <table style="width:100%;font-size:14px;">
          <tr><td><strong>Vehicle:</strong></td><td>${vehicleModel}</td></tr>
          <tr><td><strong>Renter:</strong></td><td>${renterName}</td></tr>
          <tr><td><strong>From:</strong></td><td>${fromDate}</td></tr>
          <tr><td><strong>To:</strong></td><td>${toDate}</td></tr>
          <tr><td><strong>Total Price:</strong></td><td>₹${totalPrice}</td></tr>
          <tr><td><strong>Status:</strong></td><td>${statusText}</td></tr>
        </table>
      `,
    });
  }
};