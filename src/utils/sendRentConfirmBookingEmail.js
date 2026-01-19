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
  const websiteUrl = "https://ridenow.website"; // ✅ RideNow website link

  await sendEmail({
    to: renterEmail,
    subject: "✅ Your RideNow Booking is Confirmed!",
    text: `
Booking Confirmed!

Hi ${renterName},

Your booking has been approved by the host.

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}
Host: ${hostName}

View your booking or manage your ride here:
${websiteUrl}

Please arrive on time and enjoy your ride!

— RideNow Team
    `,
    html: `
      <h2>✅ Booking Confirmed</h2>

      <p>Hi <strong>${renterName}</strong>,</p>

      <p>Your booking has been <strong>approved by the host</strong>.</p>

      <h3>Booking Details</h3>
      <ul>
        <li><strong>Vehicle:</strong> ${vehicleModel}</li>
        <li><strong>From:</strong> ${fromDate} ${fromTime}</li>
        <li><strong>To:</strong> ${toDate} ${toTime}</li>
        <li><strong>Total Price:</strong> ₹${totalPrice}</li>
        <li><strong>Host:</strong> ${hostName}</li>
      </ul>

      <p>
        👉 <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">
          Open RideNow Website
        </a>
      </p>

      <p>Please arrive on time and enjoy your ride 🚲</p>

      <p>— RideNow Team</p>
    `,
  });
};