import express from "express";

import {
  adminLogin,
  adminLogout,
  getCurrentAdmin,

  getAllUsersForAdmin,
  getUserDetailsForAdmin,
  updateUserDocumentStatus,

  getAllHostsForAdmin,
  getHostDetailsForAdmin,
  updateHostDocumentStatus,

  getAllVehiclesForAdmin,
  getVehicleDetailsForAdmin,
  updateVehicleVerificationStatus,
} from "../controllers/admin.controller.js";

import { verifyAdminJWT } from "../middlewares/admin.middlewares.js";

const router = express.Router();

/* =====================================================
   🔐 AUTH ROUTES
===================================================== */

// Admin login (ENV-based)
router.post("/login", adminLogin);

// Admin logout
router.post("/logout", verifyAdminJWT, adminLogout);

// Fetch current admin (page refresh)
router.get("/current-admin", verifyAdminJWT, getCurrentAdmin);

/* =====================================================
   👤 USERS
===================================================== */

// List all users (stats + docs)
router.get("/users", verifyAdminJWT, getAllUsersForAdmin);

// Single user full details
router.get("/users/:userId", verifyAdminJWT, getUserDetailsForAdmin);

// Approve / Reject user document
router.patch(
  "/users/document",
  verifyAdminJWT,
  updateUserDocumentStatus
);

/* =====================================================
   🏠 HOSTS
===================================================== */

// List all hosts (earnings + vehicles)
router.get("/hosts", verifyAdminJWT, getAllHostsForAdmin);

// Single host full details
router.get("/hosts/:hostId", verifyAdminJWT, getHostDetailsForAdmin);

// Approve / Reject host document
router.patch(
  "/hosts/document",
  verifyAdminJWT,
  updateHostDocumentStatus
);

/* =====================================================
   🛵 VEHICLES
===================================================== */

// List all vehicles (read-only bookings)
router.get("/vehicles", verifyAdminJWT, getAllVehiclesForAdmin);

// Single vehicle full details
router.get("/vehicles/:vehicleId", verifyAdminJWT, getVehicleDetailsForAdmin);

// Approve / Reject vehicle verification (RC)
router.patch(
  "/vehicles/verify",
  verifyAdminJWT,
  updateVehicleVerificationStatus
);

export default router;