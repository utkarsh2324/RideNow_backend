import express from "express";

// Changed to import from a new host.controller.js
import {
  loginHost,
  googleLoginHost,
  refreshHostAccessToken,
  logoutHost,
  forgotHostPassword,
  resetHostPassword,
  changeHostPassword,
  registerHost,
  verifyHostOtp,
  getCurrentHost,verifyHostAadhar,getHostDocuments,HostUpiid,getHostVehicles
} from "../controllers/host.controller.js";
import multer from "multer";
// FIX: Corrected the filename to match 'hostauth.middleware.js'
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// ================= Public Routes =================
router.post("/register", registerHost);
router.post("/verify-otp", verifyHostOtp);
router.post("/login", loginHost);
router.post("/google-login", googleLoginHost);
router.post("/refresh-token", refreshHostAccessToken);
router.post("/forgot-password", forgotHostPassword);
router.post("/reset-password", resetHostPassword);

// ================= Protected Routes =================
router.post("/logout", verifyHostJWT, logoutHost);
router.patch("/change-password", verifyHostJWT, changeHostPassword);
router.get("/current-host", verifyHostJWT, getCurrentHost); // Renamed route for clarity
router.post("/verify-aadhar", verifyHostJWT, upload.single("aadhar"), verifyHostAadhar);
router.get("/get-documents", verifyHostJWT, getHostDocuments);
router.post("/setupiid",verifyHostJWT,HostUpiid);
router.get("/gethostvehicle",verifyHostJWT,getHostVehicles);

export default router;
