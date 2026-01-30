import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import { 
    addVehicle, 
    updateVehicle, 
    searchVehicles, 
    bookVehicle,
    deleteVehicle ,verifyRC,toggleVehicleAvailability,getVehicleDetails,endBooking,getUserBookings,
   getHostBookings,confirmBookingByHost,previewVehiclePrice,cancelBookingByHost
} from "../controllers/vehicle.controller.js";

const router = express.Router();

// --- Host Protected Routes ---

// Uses upload.fields to handle photos, rc, and insurance in one request
router.post(
    "/add",
    verifyHostJWT,
    upload.fields([
        { name: 'photos', maxCount: 5 },
        { name: 'rc', maxCount: 1 }
    ]),
    addVehicle
);

router.patch("/update/:vehicleId", verifyHostJWT, updateVehicle);

router.delete("/delete/:vehicleId", verifyHostJWT, deleteVehicle);


// --- Public & RentUser Routes ---

router.get("/search", searchVehicles);

// This route is for authenticated rent users to book a vehicle
router.post("/book/:vehicleId", verifyJWT, bookVehicle);
router.post("/verify-rc", verifyHostJWT, upload.single("rc"), verifyRC);
router.patch("/:vehicleId/toggle-availability", verifyHostJWT, toggleVehicleAvailability);
router.get("/details/:vehicleId", verifyHostJWT, getVehicleDetails);
router.get("/userdetails/:vehicleId", verifyJWT, getVehicleDetails);
router.post("/end/:vehicleId", verifyJWT, endBooking);
router.get("/mybookings", verifyJWT, getUserBookings);
router.route("/bookings").get(verifyHostJWT, getHostBookings);
router.patch(
    "/host/vehicles/:vehicleId/bookings/:bookingId/confirm",
    verifyHostJWT,
    confirmBookingByHost
  );
  router.patch(
    "/host/vehicles/:vehicleId/bookings/:bookingId/cancel",
    verifyJWT,
    cancelBookingByHost
  );
  router.post(
    "/price-preview/:vehicleId",
    verifyJWT,
    previewVehiclePrice
  );
export default router;

