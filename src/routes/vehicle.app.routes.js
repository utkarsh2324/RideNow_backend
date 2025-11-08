import express from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
  searchVehicles,
  getVehicleDetails,
  bookVehicle,
  getAppUserBookings, // Use the correct function name
  endBooking,
  getVehiclePrice,
} from "../controllers/vehicle.app.controller.js";

const router = express.Router();

// --- Specific routes MUST come first ---
router.get("/search", searchVehicles);
router.get("/my-bookings", verifyJWT, getAppUserBookings); // CHANGED to '/my-bookings'

// --- Dynamic routes with :vehicleId come LAST ---
router.get("/:vehicleId", getVehicleDetails);
router.get("/:vehicleId/pricing", getVehiclePrice);
router.post("/:vehicleId/book", verifyJWT, bookVehicle);
router.post("/:vehicleId/end-booking", verifyJWT, endBooking); // This is a POST

export default router;
