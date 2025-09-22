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
  getCurrentHost
} from "../controllers/host.controller.js";

// FIX: Corrected the filename to match 'hostauth.middleware.js'
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";

const router = express.Router();

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
router.post("/change-password", verifyHostJWT, changeHostPassword);
router.get("/current-host", verifyHostJWT, getCurrentHost); // Renamed route for clarity

export default router;
