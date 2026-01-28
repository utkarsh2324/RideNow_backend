import jwt from "jsonwebtoken";

export const verifyAdminJWT = (req, res, next) => {
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

    // ✅ Validate admin identity via ENV
    if (
      decoded.role !== "admin" ||
      decoded.email !== process.env.ADMIN_EMAIL
    ) {
      return res.status(403).json({
        message: "Forbidden: Not an admin",
      });
    }

    // ✅ Attach admin directly (NO DB)
    req.admin = {
      email: decoded.email,
      role: "admin",
    };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized: Invalid admin token",
      error: err.message,
    });
  }
};