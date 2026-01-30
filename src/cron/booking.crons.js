import cron from "node-cron";
import { Vehicle } from "../models/vehicle.model.js";
import { autoCompleteExpiredBookings } from "../controllers/vehicle.controller.js";

export const startBookingCron = () => {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const vehicles = await Vehicle.find({
        "bookings.bookingStatus": "confirmed",
      });

      for (const vehicle of vehicles) {
        await autoCompleteExpiredBookings(vehicle);
      }

      console.log("⏱️ Booking auto-complete cron executed");
    } catch (err) {
      console.error("❌ Booking cron failed:", err);
    }
  });
};