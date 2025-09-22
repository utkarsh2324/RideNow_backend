// src/middlewares/hostauth.middleware.js
import jwt from "jsonwebtoken";
import { Host } from "../models/host.model.js";

export const verifyHostJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken || req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized: No token" });

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const host = await Host.findById(decoded._id).select("-password -refreshToken");
    if (!host) return res.status(401).json({ message: "Unauthorized: Host not found" });

    // FIX: Changed from req.host to req.user to avoid conflict with Express's built-in req.host
    req.user = host; 
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized: Invalid token", error: err.message });
  }
};
