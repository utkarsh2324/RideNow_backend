import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Host } from "../models/host.model.js";
import { User } from "../models/rentuser.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";

/* =====================================================
   🔐 ADMIN AUTH
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

  const token = jwt.sign(
    { role: "admin", email },
    process.env.ADMIN_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ADMIN_ACCESS_TOKEN_EXPIRY || "1d" }
  );

  res.cookie("adminAccessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json(
    new apiresponse(200, {}, "Admin logged in successfully")
  );
});

const adminLogout = asynchandler(async (req, res) => {
  res.clearCookie("adminAccessToken");
  return res.status(200).json(
    new apiresponse(200, {}, "Admin logged out successfully")
  );
});

const getCurrentAdmin = asynchandler(async (req, res) => {
  return res.status(200).json(
    new apiresponse(200, { email: req.admin.email, role: "admin" })
  );
});

/* =====================================================
   🧮 PROFILE COMPLETION
===================================================== */

const calculateProfileCompletion = (entity) => {
  let completed = 0;
  let total = 4; // phone, photo, document, email

  if (entity.phone) completed++;
  if (entity.profile?.photo) completed++;

  if (Array.isArray(entity.verifiedDoc)) {
    if (entity.verifiedDoc.length > 0) completed++;
  } else if (entity.verifiedDoc?.docUrl) {
    completed++;
  }

  if (entity.email) completed++;

  return Math.round((completed / total) * 100);
};

/* =====================================================
   👤 USERS (LIST + DETAILS + DOC VERIFY)
===================================================== */

const getAllUsersForAdmin = asynchandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");

  const enriched = await Promise.all(
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
    new apiresponse(200, enriched, "Users fetched")
  );
});

const getUserDetailsForAdmin = asynchandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select(
    "-password -refreshToken"
  );
  if (!user) throw new apierror(404, "User not found");

  const rides = await Vehicle.aggregate([
    { $unwind: "$bookings" },
    { $match: { "bookings.userId": user._id } },

    {
      $lookup: {
        from: "hosts",
        localField: "host",
        foreignField: "_id",
        as: "host",
      },
    },
    { $unwind: "$host" },

    {
      $project: {
        scootyModel: 1,
        city: 1,
        booking: {
          startDate: "$bookings.startDate",
          endDate: "$bookings.endDate",
          totalPrice: "$bookings.totalPrice",
          status: "$bookings.bookingStatus",
        },
        host: {
          name: "$host.name",
          email: "$host.email",
          phone: "$host.phone",
        },
      },
    },
  ]);

  const totalSpent = rides.reduce(
    (sum, r) => sum + (r.booking.totalPrice || 0),
    0
  );

  return res.status(200).json(
    new apiresponse(200, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.profile.photo,
        profileCompletion: calculateProfileCompletion(user),
      },
      documents: Array.isArray(user.verifiedDoc)
      ? user.verifiedDoc
      : [],
      rides,
      totalSpent,
      totalRides: rides.length,
    })
  );
});

const updateUserDocumentStatus = asynchandler(async (req, res) => {
  const { userId, docIndex, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid status");
  }

  const user = await User.findById(userId);
  if (!user || !user.verifiedDoc[docIndex]) {
    throw new apierror(404, "Document not found");
  }

  user.verifiedDoc[docIndex].status = status;
  user.isDocVerified = status === "approved";

  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new apiresponse(200, {}, "User document updated")
  );
});

/* =====================================================
   🏠 HOSTS (LIST + DETAILS + DOC VERIFY)
===================================================== */

const getAllHostsForAdmin = asynchandler(async (req, res) => {
  const hosts = await Host.find()
    .populate("vehicles")
    .select("-password -refreshToken");

  const enriched = await Promise.all(
    hosts.map(async (host) => {
      const stats = await Vehicle.aggregate([
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
        totalBookings: stats[0]?.totalBookings || 0,
        totalEarnings: stats[0]?.totalEarnings || 0,
      };
    })
  );

  return res.status(200).json(
    new apiresponse(200, enriched, "Hosts fetched")
  );
});

const getHostDetailsForAdmin = asynchandler(async (req, res) => {
  const host = await Host.findById(req.params.hostId)
    .populate("vehicles")
    .select("-password -refreshToken");

  if (!host) throw new apierror(404, "Host not found");

  const bookings = await Vehicle.aggregate([
    { $match: { host: host._id } },
    { $unwind: "$bookings" },

    {
      $lookup: {
        from: "users",
        localField: "bookings.userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },

    {
      $project: {
        scootyModel: 1,
        city: 1,
        booking: {
          startDate: "$bookings.startDate",
          endDate: "$bookings.endDate",
          totalPrice: "$bookings.totalPrice",
          status: "$bookings.bookingStatus",
        },
        user: {
          name: "$user.name",
          email: "$user.email",
          phone: "$user.phone",
        },
      },
    },
  ]);

  const totalEarnings = bookings.reduce(
    (sum, b) => sum + (b.booking.totalPrice || 0),
    0
  );

  return res.status(200).json(
    new apiresponse(200, {
      host: {
        _id: host._id,
        name: host.name,
        email: host.email,
        phone: host.phone,
        photo: host.profile.photo,
        profileCompletion: calculateProfileCompletion({
          phone: host.phone,
          profile: host.profile,
          verifiedDoc: [host.verifiedDoc],
          email: host.email,
        }),
      },
      documents: host.verifiedDoc?.docUrl
  ? host.verifiedDoc
  : null,
      vehicles: host.vehicles,
      bookings,
      totalBookings: bookings.length,
      totalEarnings,
    })
  );
});

const updateHostDocumentStatus = asynchandler(async (req, res) => {
  const { hostId, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid status");
  }

  const host = await Host.findById(hostId);
  if (!host) throw new apierror(404, "Host not found");

  host.verifiedDoc.status = status;
  host.isDocVerified = status === "approved";

  await host.save({ validateBeforeSave: false });

  return res.status(200).json(
    new apiresponse(200, {}, "Host document updated")
  );
});

/* =====================================================
   🛵 VEHICLES (READ-ONLY BOOKINGS)
===================================================== */

const getAllVehiclesForAdmin = asynchandler(async (req, res) => {
  const vehicles = await Vehicle.find()
    .populate("host", "name email phone")
    .populate("bookings.userId", "name email phone profile.photo");

  return res.status(200).json(
    new apiresponse(200, vehicles)
  );
});

const getVehicleDetailsForAdmin = asynchandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.vehicleId)
    .populate("host", "name email phone profile.photo")
    .populate("bookings.userId", "name email phone profile.photo");

  if (!vehicle) throw new apierror(404, "Vehicle not found");

  const totalEarnings = vehicle.bookings.reduce(
    (sum, b) => sum + (b.totalPrice || 0),
    0
  );

  return res.status(200).json(
    new apiresponse(200, {
      _id: vehicle._id,
      scootyModel: vehicle.scootyModel,
      city: vehicle.city,
      photos: vehicle.photos,
      rc: vehicle.documents?.rc || null,
      isVerified: vehicle.isVerified,

      host: vehicle.host,

      totalBookings: vehicle.bookings.length,
      totalEarnings,

      bookings: vehicle.bookings.map((b) => ({
        startDate: b.startDate,
        endDate: b.endDate,
        totalPrice: b.totalPrice,
        status: b.bookingStatus,
        user: b.userId
          ? {
              name: b.userId.name,
              email: b.userId.email,
              phone: b.userId.phone,
            }
          : null,
      })),
    })
  );
});

const updateVehicleVerificationStatus = asynchandler(async (req, res) => {
  const { vehicleId, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new apierror(400, "Invalid status");
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
   📦 EXPORTS
===================================================== */

export {
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
};