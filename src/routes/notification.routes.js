import express from "express";
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";
import {
  getHostNotifications,
  markHostNotificationAsRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/my", verifyHostJWT, getHostNotifications);
router.patch("/:id/read", verifyHostJWT, markHostNotificationAsRead);

export default router;