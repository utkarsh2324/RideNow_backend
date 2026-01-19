import { resend } from "../utils/resend.js"; // or your resend instance

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
  await resend.emails.send({
    from: "no-reply@ridenow.website",
    to: hostEmail,
    subject: "🚲 New Booking Request on RideNow",
    text: `
New Booking Request

Renter: ${renterName}
Email: ${renterEmail}
Phone: ${renterPhone}

Vehicle: ${vehicleModel}
From: ${fromDate} ${fromTime}
To: ${toDate} ${toTime}
Total Price: ₹${totalPrice}

Please login to RideNow to approve or reject the booking.
    `,
    html: `
      <h2>🚲 New Booking Request</h2>

      <p><strong>Renter Details</strong></p>
      <ul>
        <li>Name: ${renterName}</li>
        <li>Email: ${renterEmail}</li>
        <li>Phone: ${renterPhone}</li>
      </ul>

      <p><strong>Booking Details</strong></p>
      <ul>
        <li>Vehicle: ${vehicleModel}</li>
        <li>From: ${fromDate} ${fromTime}</li>
        <li>To: ${toDate} ${toTime}</li>
        <li>Total Price: ₹${totalPrice}</li>
        <li>Status: Pending Approval</li>
      </ul>

      <p>Please login to RideNow to approve or reject this booking.</p>

      <p>— RideNow Team</p>
    `,
  });
};