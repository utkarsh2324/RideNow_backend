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
  getCurrentUser,
  verifyAadhar,verifyDL,getDocuments

} from "../controllers/rentuser.controller.js";
import multer from "multer";


import { verifyJWT } from "../middlewares/auth.middlewares.js";
const storage = multer.memoryStorage();
const upload = multer({ storage });
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
router.post("/verify-aadhar", verifyJWT, upload.single("aadhar"), verifyAadhar);
router.post("/verify-dl", verifyJWT, upload.single("dl"), verifyDL);
router.get("/get-documents", verifyJWT, getDocuments);
export default router;