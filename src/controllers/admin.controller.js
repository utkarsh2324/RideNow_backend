import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Host } from "../models/host.model.js";
import { User } from "../models/rentuser.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";

/* =====================================================
   🔐 ADMIN AUTH (ENV BASED LOGIN)
===================================================== */

const adminLogin = asynchandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new apierror(400, "Email and password are required");
  }

  if (email !== process.env.ADMIN_EMAIL) {
    throw new apierror(401, "Invalid admin credentials");
  }

  const isPasswordCorrect = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if (!isPasswordCorrect) {
    throw new apierror(401, "Invalid admin credentials");
  }

  const adminAccessToken = jwt.sign(
    { role: "admin", email },
    process.env.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ADMIN_ACCESS_TOKEN_EXPIRY || "1d" }
  );

  res.cookie("adminAccessToken", adminAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json(
    new apiresponse(200, {}, "Admin logged in successfully")
  );
});

const adminLogout = asynchandler(async (req, res) => {
  res.clearCookie("adminAccessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res
    .status(200)
    .json(new apiresponse(200, {}, "Admin logged out successfully"));
});
const getCurrentAdmin = asynchandler(async (req, res) => {
  return res.status(200).json(
    new apiresponse(
      200,
      {
        email: req.admin.email,
        role: "admin",
      },
      "Current admin fetched successfully"
    )
  );
});
/* =====================================================
   👤 RENT USERS (VIEW + STATS + DOC APPROVAL)
===================================================== */

const getAllUsersForAdmin = asynchandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");

  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      const stats = await Vehicle.aggregate([
        { $unwind: "$bookings" },
        { $match: { "bookings.userId": user._id } },
        {
          $group: {
            _id: null,
            totalRides: { $sum: 1 },
            totalSpent: { $sum: "$bookings.totalPrice" },
          },
        },
      ]);

      return {
        ...user.toObject(),
        totalRides: stats[0]?.totalRides || 0,
        totalSpent: stats[0]?.totalSpent || 0,
      };
    })
  );

  return res.status(200).json(
    new apiresponse(200, usersWithStats, "Rent users fetched successfully")
  );
});

const updateUserDocumentStatus = asynchandler(async (req, res) => {
  const { userId, docIndex, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid document status");
  }

  const user = await User.findById(userId);
  if (!user) throw new apierror(404, "User not found");

  if (!user.verifiedDoc[docIndex]) {
    throw new apierror(400, "Invalid document index");
  }

  user.verifiedDoc[docIndex].status = status;
  user.isDocVerified = status === "approved";

  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new apiresponse(200, {}, "User document status updated")
  );
});

/* =====================================================
   🏠 HOSTS (VEHICLES + EARNINGS + DOC APPROVAL)
===================================================== */

const getAllHostsForAdmin = asynchandler(async (req, res) => {
  const hosts = await Host.find()
    .populate("vehicles")
    .select("-password -refreshToken");

  const hostsWithStats = await Promise.all(
    hosts.map(async (host) => {
      const earnings = await Vehicle.aggregate([
        { $match: { host: host._id } },
        { $unwind: "$bookings" },
        {
          $match: {
            "bookings.bookingStatus": { $in: ["confirmed", "completed"] },
          },
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalEarnings: { $sum: "$bookings.totalPrice" },
          },
        },
      ]);

      return {
        ...host.toObject(),
        totalVehicles: host.vehicles.length,
        totalBookings: earnings[0]?.totalBookings || 0,
        totalEarnings: earnings[0]?.totalEarnings || 0,
      };
    })
  );

  return res.status(200).json(
    new apiresponse(200, hostsWithStats, "Hosts fetched successfully")
  );
});

const updateHostDocumentStatus = asynchandler(async (req, res) => {
  const { hostId, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid document status");
  }

  const host = await Host.findById(hostId);
  if (!host) throw new apierror(404, "Host not found");

  host.verifiedDoc.status = status;
  host.isDocVerified = status === "approved";

  await host.save({ validateBeforeSave: false });

  return res.status(200).json(
    new apiresponse(200, {}, "Host document status updated")
  );
});

/* =====================================================
   🛵 VEHICLES (VIEW + RC VERIFICATION)
===================================================== */

const getAllVehiclesForAdmin = asynchandler(async (req, res) => {
  const vehicles = await Vehicle.find()
    .populate("host", "name email phone")
    .populate("bookings.userId", "name email");

  return res.status(200).json(
    new apiresponse(200, vehicles, "Vehicles fetched successfully")
  );
});

const updateVehicleVerificationStatus = asynchandler(async (req, res) => {
  const { vehicleId, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid verification status");
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new apierror(404, "Vehicle not found");

  vehicle.isVerified = status === "approved";
  await vehicle.save({ validateBeforeSave: false });

  return res.status(200).json(
    new apiresponse(200, {}, "Vehicle verification updated")
  );
});

/* =====================================================
   📦 EXPORTS (AS REQUESTED)
===================================================== */

export {
  adminLogin,
  adminLogout,
  getAllUsersForAdmin,
  updateUserDocumentStatus,
  getAllHostsForAdmin,
  updateHostDocumentStatus,
  getAllVehiclesForAdmin,
  updateVehicleVerificationStatus,getCurrentAdmin
};