import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import { 
    addVehicle, 
    updateVehicle, 
    searchVehicles, 
    bookVehicle,
    deleteVehicle ,verifyRC,toggleVehicleAvailability,getVehicleDetails
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
export default router;

