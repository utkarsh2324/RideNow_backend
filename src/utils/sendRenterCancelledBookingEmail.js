export const sendRenterBookingCancelledEmail = async ({
    renterEmail,
    renterName,
    vehicleModel,
    fromDate,
    fromTime,
    toDate,
    toTime,
    reason = "The vehicle was booked by another renter for the same time slot.",
  }) => {
    const subject = "❌ Your RideNow Booking Was Cancelled";
  
    const html = `
      <h2 style="text-align:center;color:#dc2626;margin-bottom:12px;">
        Booking Cancelled
      </h2>
  
      <p style="font-size:15px;">
        Hi <strong>${renterName || "Rider"}</strong>,
      </p>
  
      <p style="font-size:15px;">
        We’re sorry to inform you that your booking for the vehicle
        <strong>${vehicleModel}</strong> could not be confirmed and has been
        <strong style="color:#dc2626;">cancelled</strong>.
      </p>
  
      <div style="
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:16px;
        margin:20px 0;
        font-size:14px;
      ">
        <p style="margin:0 0 6px;"><strong>📅 Booking Period</strong></p>
        <p style="margin:0;">${fromDate} ${fromTime}</p>
        <p style="margin:0;">to ${toDate} ${toTime}</p>
      </div>
  
      <p style="font-size:14px;color:#555;">
        <strong>Reason:</strong> ${reason}
      </p>
  
      <p style="font-size:14px;">
        Don’t worry — you can explore other available vehicles nearby and make a
        new booking anytime.
      </p>
  
      <p style="margin-top:20px;font-size:14px;">
        Thank you for choosing <strong>RideNow</strong>. We appreciate your
        understanding.
      </p>
  
      <p style="margin-top:24px;">
        🚲 Happy Riding! <br />
        <strong>Team RideNow</strong>
      </p>
    `;
  
    await sendEmail({
      to: renterEmail,
      subject,
      text: `Your booking for ${vehicleModel} was cancelled.`,
      html,
    });
  };