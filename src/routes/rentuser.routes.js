import express from "express";

import {

  login,
  googleLogin,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  registerUser,verifyOtp,
  getCurrentUser

} from "../controllers/rentuser.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = express.Router();

// ================= Public Routes =================
router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ================= Protected Routes =================
router.post("/logout", verifyJWT, logout);
router.post("/change-password", verifyJWT, changePassword);

router.get("/current-user", verifyJWT, getCurrentUser);
export default router;