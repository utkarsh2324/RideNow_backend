import express from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
  searchVehicles,
  getVehicleDetails,
  bookVehicle,
  getAppUserBookings,
  endBooking,
  previewVehiclePrice,
} from "../controllers/vehicle.app.controller.js";

const router = express.Router();

// --- Specific routes MUST come first ---
router.get("/search", searchVehicles);
router.get("/my-bookings", verifyJWT, getAppUserBookings);

// --- Dynamic routes with :vehicleId come LAST ---
router.get("/:vehicleId", getVehicleDetails);
router.post("/:vehicleId/preview-price", verifyJWT, previewVehiclePrice);
router.post("/:vehicleId/book", verifyJWT, bookVehicle);
router.post("/:vehicleId/end-booking", verifyJWT, endBooking);

export default router;
