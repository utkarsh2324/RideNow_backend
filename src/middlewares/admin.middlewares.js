import jwt from "jsonwebtoken";
import { Admin } from "../models/admin.model.js";

export const verifyAdminJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.adminAccessToken ||
      req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized: No admin token",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.ADMIN_ACCESS_TOKEN_SECRET
    );

    const admin = await Admin.findById(decoded._id);
    if (!admin) {
      return res.status(401).json({
        message: "Unauthorized: Admin not found",
      });
    }

    req.admin = admin; // attach admin to request
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized: Invalid admin token",
      error: err.message,
    });
  }
};