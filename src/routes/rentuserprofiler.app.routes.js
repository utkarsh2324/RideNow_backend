/**
 * @fileoverview App routes for User Profile.
 * Connects to the app-specific profile controllers.
 */

import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

// Import APP controllers from the new app-specific controller file
import {
  uploadProfilePhoto,
  updateBasicInfo,
  updateMobileNumber,
  updateUserProfile,
  uploadVerificationDoc, // Note: This is deprecated
} from "../controllers/rentuserprofile.app.controller.js"; // <-- Note '.app'

const router = express.Router();

// Route for uploading profile photo (image)
router.post(
  "/upload-photo",
  verifyJWT,
  upload.single("photo"), // Expects a key "photo"
  uploadProfilePhoto
);

// Route for specific basic info update
router.patch("/update-basic", verifyJWT, updateBasicInfo);

// Route for specific mobile number update
router.patch("/update-mobile", verifyJWT, updateMobileNumber);

// This endpoint handles updating name, dob, phone, etc. all at once
router.patch("/update", verifyJWT, updateUserProfile);

// This is the old/deprecated route for uploading documents.
// It's better to remove it and use /users/verify-aadhar and /users/verify-dl
router.post(
  "/upload-doc",
  verifyJWT,
  upload.single("document"), // Expects a key "document"
  uploadVerificationDoc
);

export default router;
