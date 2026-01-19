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
  const websiteUrl = "https://ridenow.website"; // ✅ your website link

  await sendEmail({
    to: hostEmail,
    subject: "🚲 New Booking Request on RideNow",
    text: `
New Booking Request

Renter Name: ${renterName}
Renter Email: ${renterEmail}
Renter Phone: ${renterPhone}

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}

Manage your booking here:
${websiteUrl}

Please login to RideNow to approve or reject this booking.
    `,
    html: `
      <h2>🚲 New Booking Request</h2>

      <p><strong>Host:</strong> ${hostName}</p>

      <h3>Renter Details</h3>
      <ul>
        <li><strong>Name:</strong> ${renterName}</li>
        <li><strong>Email:</strong> ${renterEmail}</li>
        <li><strong>Phone:</strong> ${renterPhone}</li>
      </ul>

      <h3>Booking Details</h3>
      <ul>
        <li><strong>Vehicle:</strong> ${vehicleModel}</li>
        <li><strong>From:</strong> ${fromDate} ${fromTime}</li>
        <li><strong>To:</strong> ${toDate} ${toTime}</li>
        <li><strong>Total Price:</strong> ₹${totalPrice}</li>
        <li><strong>Status:</strong> Pending Approval</li>
      </ul>

      <p>
        👉 <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">
          Open RideNow Website
        </a>
      </p>

      <p>Please login to <strong>RideNow</strong> to approve or reject this booking.</p>

      <p>— RideNow Team</p>
    `,
  });
};