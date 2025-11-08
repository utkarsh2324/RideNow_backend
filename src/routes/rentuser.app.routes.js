/**
 * @fileoverview App routes for User Authentication.
 * Connects to the app-specific controllers.
 */

import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

// Import APP controllers from the new app-specific controller file
import {
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  registerUser,
  verifyOtp,
  getCurrentUser,
  verifyAadhar,
  verifyDL,
  getDocuments,
} from "../controllers/rentuser.app.controller.js"; // <-- Note the '.app'

const router = express.Router();

// ================= Public App Routes =================
router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ================= Protected App Routes =================
router.post("/logout", verifyJWT, logout);
router.post("/change-password", verifyJWT, changePassword);
router.get("/current-user", verifyJWT, getCurrentUser);

// Route for verifying Aadhar
router.post(
  "/verify-aadhar",
  verifyJWT,
  upload.single("file"), // The new functions expect the key "file"
  verifyAadhar
);

// Route for verifying Driving License
router.post(
  "/verify-dl",
  verifyJWT,
  upload.single("file"), // The new functions expect the key "file"
  verifyDL
);

// Route for getting document status
router.get("/documents", verifyJWT, getDocuments);

// --- THIS IS THE FIX ---
export default router;
