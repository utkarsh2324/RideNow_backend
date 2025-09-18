import jwt from "jsonwebtoken";
import { User } from "../models/rentuser.model.js";

export const verifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken || req.headers["authorization"]?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Unauthorized: No token" });

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded._id);
    if (!user) return res.status(401).json({ message: "Unauthorized: User not found" });

    req.user = user; // attach user to request
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized: Invalid token", error: err.message });
  }
};