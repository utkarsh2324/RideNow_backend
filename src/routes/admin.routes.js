import express from "express";

import {
  adminLogin,
  adminLogout,
  getAllUsersForAdmin,
  updateUserDocumentStatus,
  getAllHostsForAdmin,
  updateHostDocumentStatus,
  getAllVehiclesForAdmin,
  updateVehicleVerificationStatus,getCurrentAdmin
} from "../controllers/admin.controller.js";

import { verifyAdminJWT } from "../middlewares/admin.middlewares.js";

const router = express.Router();

/* ================= PUBLIC ROUTES ================= */

// Admin Login (ENV based)
router.post("/login", adminLogin);

/* ================= PROTECTED ROUTES ================= */

// Admin Logout
router.post("/logout", verifyAdminJWT, adminLogout);
router.get(
    "/current-admin",
    verifyAdminJWT,
    getCurrentAdmin
  );
/* ---------- RENT USERS ---------- */

// Get all rent users with stats
router.get("/users", verifyAdminJWT, getAllUsersForAdmin);

// Approve / Reject user documents
router.patch(
  "/user/update-doc-status",
  verifyAdminJWT,
  updateUserDocumentStatus
);

/* ---------- HOSTS ---------- */

// Get all hosts with earnings & vehicles
router.get("/hosts", verifyAdminJWT, getAllHostsForAdmin);

// Approve / Reject host Aadhaar
router.patch(
  "/host/update-doc-status",
  verifyAdminJWT,
  updateHostDocumentStatus
);

/* ---------- VEHICLES ---------- */

// Get all vehicles with host + bookings
router.get("/vehicles", verifyAdminJWT, getAllVehiclesForAdmin);

// Approve / Reject vehicle RC
router.patch(
  "/vehicle/update-verification",
  verifyAdminJWT,
  updateVehicleVerificationStatus
);

export default router;