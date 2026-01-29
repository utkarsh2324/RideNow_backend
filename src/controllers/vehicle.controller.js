import { Host } from "../models/host.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/rentuser.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";
import axios from "axios";
import mongoose, { Schema } from "mongoose";
import { sendSMS } from "../utils/twilio.js";
import { sendHostBookingEmail } from "../utils/sendHostBookingEmail.js";
import { sendRenterBookingConfirmedEmail } from "../utils/sendRentConfirmBookingEmail.js";
import { sendBookingEndedEmail } from "../utils/sendBookingEndedEmail.js";
import { calculateBookingPrice } from "../utils/calculateBookingprice.js";
const addVehicle = asynchandler(async (req, res) => {
  const {
    scootyModel,
    address,
    landmark,
    city,
    weekdayPrice,
    weekendPrice,
    lat,
    lng,
  } = req.body;

  const hostId = req.user._id;

  // ✅ Basic validation
  if (
    !scootyModel ||
    !address ||
    !city ||
    !weekdayPrice ||
    !weekendPrice
  ) {
    throw new apierror(400, "All required fields including pricing are mandatory.");
  }

  if (Number(weekendPrice) < Number(weekdayPrice)) {
    throw new apierror(400, "Weekend price cannot be less than weekday price.");
  }

  if (!req.files || !req.files.photos || !req.files.rc) {
    throw new apierror(
      400,
      "Vehicle photos and RC document are required."
    );
  }

  // 📤 Upload images
  const photoUploadPromises = req.files.photos.map(file =>
    uploadOnCloudinary(file.buffer)
  );

  const rcUploadPromise = uploadOnCloudinary(req.files.rc[0].buffer);

  const [photoResults, rcResult] = await Promise.all([
    Promise.all(photoUploadPromises),
    rcUploadPromise,
  ]);

  const photoUrls = photoResults.map(result => result.secure_url);

  // 🚗 Create vehicle (GEOJSON FIX APPLIED ✅)
  const vehicle = await Vehicle.create({
    host: hostId,
    scootyModel,
    pickupLocation: {
      address,
      landmark,
      city,
      ...(lat && lng && {
        coordinates: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)], // MUST be [lng, lat]
        },
      }),
    },
    pricing: {
      weekdayPrice: Number(weekdayPrice),
      weekendPrice: Number(weekendPrice),
    },
    photos: photoUrls,
    documents: {
      rc: rcResult.secure_url,
    },
    isVerified: true,
  });

  // 🔗 Attach vehicle to host
  await Host.findByIdAndUpdate(
    hostId,
    { $push: { vehicles: vehicle._id } }
  );

  return res.status(201).json(
    new apiresponse(
      201,
      vehicle,
      "Vehicle added successfully. Awaiting verification."
    )
  );
});
const verifyRC = asynchandler(async (req, res) => {
  if (!req.file) {
    throw new apierror(400, "RC file is required.");
  }

  const hostId = req.user._id;
  const host = await Host.findById(hostId);

  if (!host) {
    throw new apierror(404, "Host not found.");
  }

  // 🔹 Upload RC to Cloudinary
  const uploadResult = await uploadOnCloudinary(req.file.buffer, "pdf");

  // ❗ DO NOT verify automatically
  return res.status(200).json(
    new apiresponse(
      200,
      {
        rcUrl: uploadResult.secure_url,
        status: "pending",
      },
      "📄 RC uploaded successfully. Verification pending."
    )
  );
});
const updateVehicle = asynchandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { pickupLocation, pricing, lat, lng } = req.body;
  const hostId = req.user._id;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new apierror(404, "Vehicle not found");

  if (vehicle.host.toString() !== hostId.toString()) {
    throw new apierror(403, "Forbidden");
  }

  /* ---------- PRICE UPDATE CHECK ---------- */
  const isPriceUpdate =
    pricing?.weekdayPrice !== undefined ||
    pricing?.weekendPrice !== undefined;

  if (isPriceUpdate) {
    const hasActiveBooking = vehicle.bookings.some(
      (b) =>
        b.bookingStatus === "confirmed" &&
        new Date(b.endDate) >= new Date()
    );

    if (hasActiveBooking) {
      throw new apierror(
        400,
        "Cannot update pricing while vehicle has an active booking"
      );
    }
  }

  /* ---------- UPDATE LOCATION TEXT ---------- */
  if (pickupLocation) {
    if (pickupLocation.address !== undefined)
      vehicle.pickupLocation.address = pickupLocation.address;

    if (pickupLocation.landmark !== undefined)
      vehicle.pickupLocation.landmark = pickupLocation.landmark;

    if (pickupLocation.city !== undefined)
      vehicle.pickupLocation.city = pickupLocation.city;
  }

  /* ---------- UPDATE GPS (ONLY IF PROVIDED) ---------- */
  if (lat && lng) {
    vehicle.pickupLocation.coordinates = {
      type: "Point",
      coordinates: [Number(lng), Number(lat)],
    };
  }

  /* ---------- UPDATE PRICING ---------- */
  if (pricing?.weekdayPrice !== undefined) {
    vehicle.pricing.weekdayPrice = Number(pricing.weekdayPrice);
  }

  if (pricing?.weekendPrice !== undefined) {
    vehicle.pricing.weekendPrice = Number(pricing.weekendPrice);
  }

  if (vehicle.pricing.weekendPrice < vehicle.pricing.weekdayPrice) {
    throw new apierror(
      400,
      "Weekend price cannot be less than weekday price"
    );
  }

  // ✅ CRITICAL FIX
  await vehicle.save({ validateModifiedOnly: true });

  const updatedVehicle = await Vehicle.findById(vehicle._id)
    .populate("host", "name email phone");

  return res.status(200).json(
    new apiresponse(200, updatedVehicle, "Vehicle updated successfully")
  );
});
const toggleVehicleAvailability = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { isAvailable } = req.body; // comes from frontend toggle
    const hostId = req.user._id; // authenticated host
  
    if (typeof isAvailable !== "boolean") {
      throw new apierror(400, "Invalid or missing 'isAvailable' field.");
    }
  
    // Find the vehicle owned by the current host
    const vehicle = await Vehicle.findOne({ _id: vehicleId, host: hostId });
  
    if (!vehicle) {
      throw new apierror(404, "Vehicle not found or you are not authorized to modify it.");
    }
  
    // Update availability
    vehicle.isAvailable = isAvailable;

    await vehicle.save();
  
    return res.status(200).json(
      new apiresponse(
        200,
        { vehicleId: vehicle._id, isAvailable: vehicle.isAvailable },
        `Vehicle is now ${isAvailable ? "Available ✅" : "Unavailable 🚫"}`
      )
    );
  });
  const searchVehicles = asynchandler(async (req, res) => {
    const {
      location,
      lat,
      lng,
      fromDate,
      toDate,
      fromTime,
      toTime,
    } = req.query;
  
    if (!fromDate || !toDate || !fromTime || !toTime) {
      throw new apierror(400, "Date and time are required.");
    }
  
    const requestedStart = new Date(`${fromDate}T${fromTime}:00`);
    const requestedEnd = new Date(`${toDate}T${toTime}:00`);
  
    if (requestedStart >= requestedEnd) {
      throw new apierror(400, "Invalid date/time range.");
    }
  
    const bookingFilter = {
      $not: {
        $elemMatch: {
          bookingStatus: "confirmed",
          startDate: { $lt: requestedEnd },
          endDate: { $gt: requestedStart },
        },
      },
    };
  
    let vehicles = [];
  
    /* ---------------- GEO SEARCH (20 KM) ---------------- */
    if (lat && lng) {
      vehicles = await Vehicle.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(lng), Number(lat)],
            },
            distanceField: "distanceInMeters",
            maxDistance: 50 * 1000, // 20 KM
            spherical: true,
            query: {
              isVerified: true,
              isAvailable: true,
              bookings: bookingFilter,
            },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "host",
            foreignField: "_id",
            as: "host",
          },
        },
        { $unwind: "$host" },
      ]);
    }
  
    /* ---------------- CITY / TEXT SEARCH ---------------- */
    if (location) {
      const locationParts = location
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((part) => new RegExp(part, "i"));
  
      const cityVehicles = await Vehicle.find({
        isVerified: true,
        isAvailable: true,
        $or: [
          { "pickupLocation.city": { $in: locationParts } },
          { "pickupLocation.address": { $in: locationParts } },
        ],
        bookings: bookingFilter,
      }).populate("host", "name email");
  
      vehicles = [...vehicles, ...cityVehicles];
    }
  
    /* ---------------- REMOVE DUPLICATES ---------------- */
    const uniqueVehicles = Object.values(
      vehicles.reduce((acc, v) => {
        const id = v._id.toString();
    
        // keep geoNear version if it already exists
        if (!acc[id] || acc[id].distanceInMeters === undefined) {
          acc[id] = v;
        }
    
        return acc;
      }, {})
    );
  
    return res.status(200).json(
      new apiresponse(
        200,
        uniqueVehicles,
        "Nearby and city-based vehicles fetched successfully."
      )
    );
  });
const previewVehiclePrice = async (req, res) => {
    const { vehicleId } = req.params;
    const { fromDate, toDate, fromTime = "10:00", toTime = "18:00" } = req.body;
  
    if (!fromDate || !toDate) {
      throw new apierror(400, "Booking dates are required");
    }
  
    const startDate = new Date(`${fromDate}T${fromTime}:00`);
    const endDate = new Date(`${toDate}T${toTime}:00`);
  
    if (endDate <= startDate) {
      throw new apierror(400, "Invalid date range");
    }
  
    const vehicle = await Vehicle.findById(vehicleId);
  
    if (!vehicle || !vehicle.isAvailable) {
      throw new apierror(404, "Vehicle not available");
    }
  
    const totalPrice = calculateBookingPrice(
      startDate,
      endDate,
      vehicle.pricing
    );
  
    const totalDays = Math.ceil(
      (endDate - startDate) / (1000 * 60 * 60 * 24)
    );
  
    return res.status(200).json(
      new apiresponse(200, {
        totalPrice,
        totalDays,
        weekdayPrice: vehicle.pricing.weekdayPrice,
        weekendPrice: vehicle.pricing.weekendPrice,
        averagePerDay: Math.round(totalPrice / totalDays),
      }, "Price preview calculated")
    );
  };
const bookVehicle = asynchandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { fromDate, toDate, fromTime, toTime } = req.body;
  const userId = req.user._id;

  const startDate = new Date(`${fromDate}T${fromTime}:00`);
  const endDate = new Date(`${toDate}T${toTime}:00`);

  if (endDate <= startDate) {
    throw new apierror(400, "Invalid booking time range.");
  }

  const user = await User.findById(userId);
  if (!user || !user.isDocVerified) {
    throw new apierror(403, "User not verified.");
  }

  const vehicle = await Vehicle.findById(vehicleId).populate("host");
  if (!vehicle || !vehicle.isAvailable) {
    throw new apierror(400, "Vehicle not available.");
  }

  // 🚫 Conflict check (you already have this correct)
  const conflict = vehicle.bookings.some(
    (b) =>
      b.bookingStatus === "confirmed" &&
      startDate < b.endDate &&
      endDate > b.startDate
  );

  if (conflict) {
    throw new apierror(400, "Vehicle already booked for this slot.");
  }

  // 💰 PRICE CALCULATION — THIS IS WHERE IT BELONGS
  const totalPrice = calculateBookingPrice(
    startDate,
    endDate,
    vehicle.pricing
  );

  vehicle.bookings.push({
    userId,
    startDate,
    endDate,
    totalPrice,
    bookingStatus: "pending",
  });

  await vehicle.save();

  /* ---------- SEND EMAIL TO HOST ---------- */
  if (vehicle.host?.email) {
    await sendHostBookingEmail({
      hostEmail: vehicle.host.email,
      hostName: vehicle.host.name,
      renterName: user.name,
      renterEmail: user.email,
      renterPhone: user.phone,
      vehicleModel: vehicle.scootyModel,
      fromDate,
      fromTime,
      toDate,
      toTime,
      totalPrice, // calculated securely
    });
  }

  return res.status(200).json(
    new apiresponse(
      200,
      { totalPrice },
      "Booking request sent. Host has been notified via email."
    )
  );
});
const deleteVehicle = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
    const hostId = req.user._id;
  
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new apierror(404, "Vehicle not found");
  
    if (vehicle.host.toString() !== hostId.toString()) {
      throw new apierror(403, "Forbidden: You are not authorized to delete this vehicle");
    }
  
    // ✅ Delete vehicle from Vehicle collection
    await Vehicle.findByIdAndDelete(vehicleId);
  
    // ✅ Properly remove from Host model (handles both ObjectId or string)
    await Host.findByIdAndUpdate(
      hostId,
      {
        $pull: {
          vehicles: { $in: [vehicleId, new mongoose.Types.ObjectId(vehicleId)] },
        },
      },
      { new: true }
    );
  
    return res
      .status(200)
      .json(new apiresponse(200, {}, "Vehicle deleted successfully"));
  });
  const getVehicleDetails = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
  
    if (!vehicleId) {
      throw new apierror(400, "Vehicle ID is required.");
    }
  
    const vehicle = await Vehicle.findById(vehicleId)
      .populate({
        path: "host",
        select: "name email phone profile"
      })
      .lean();
  
    if (!vehicle) {
      throw new apierror(404, "Vehicle not found.");
    }
  
    const vehicleDetails = {
      _id: vehicle._id,
      scootyModel: vehicle.scootyModel,
    
      pickupLocation: {
        address: vehicle.pickupLocation?.address || "",
        landmark: vehicle.pickupLocation?.landmark || "",
        city: vehicle.pickupLocation?.city || "",
        coordinates: vehicle.pickupLocation?.coordinates || null,
      },
    
      photos: vehicle.photos,
      rcDocument: vehicle.documents?.rc,
      isVerified: vehicle.isVerified,
      isAvailable: vehicle.isAvailable,
      pricing: vehicle.pricing,
    
      host: {
        _id: vehicle.host?._id,
        name: vehicle.host?.name,
        email: vehicle.host?.email,
        phone: vehicle.host?.phone,
        photo: vehicle.host?.profile?.photo || "",
      },
    };
  
    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          vehicleDetails,
          "Vehicle details fetched successfully."
        )
      );
  });
 const endBooking = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const { vehicleId } = req.params;
    const now = new Date();
  
    const user = await User.findById(userId);
    if (!user) throw new apierror(404, "User not found.");
  
    const vehicle = await Vehicle.findById(vehicleId).populate("host");
    if (!vehicle) throw new apierror(404, "Vehicle not found.");
  
    const activeBooking = vehicle.bookings.find(
      (b) =>
        (b.bookingStatus === "confirmed" || b.bookingStatus === "pending") &&
        b.userId.toString() === userId.toString()
    );
  
    if (!activeBooking) {
      throw new apierror(400, "No active booking found.");
    }
  
    const isExpired = new Date(activeBooking.endDate) < now;
  
    activeBooking.bookingStatus = "completed";
    activeBooking.returnedAt = now;
  
    vehicle.isAvailable = true;
    vehicle.NumberOfBooking = (vehicle.NumberOfBooking || 0) + 1;
  
    user.isBookedVehicle = false;
  
    await vehicle.save();
    await user.save();
    console.log("📨 Ending booking → sending emails");
    /* ---------- SEND EMAIL TO BOTH HOST & RENTER ---------- */
    await sendBookingEndedEmail({
      renterEmail: user.email,
      renterName: user.name,
      hostEmail: vehicle.host?.email,
      hostName: vehicle.host?.name,
      vehicleModel: vehicle.scootyModel,
      fromDate: activeBooking.startDate.toLocaleDateString(),
      toDate: activeBooking.endDate.toLocaleDateString(),
      totalPrice: activeBooking.totalPrice,
      autoEnded: isExpired,
    });
  
    return res.status(200).json(
      new apiresponse(
        200,
        {
          vehicleId,
          bookingId: activeBooking._id,
          bookingStatus: activeBooking.bookingStatus,
          autoEnded: isExpired,
        },
        isExpired
          ? "Booking automatically ended and emails sent."
          : "Booking ended successfully and emails sent."
      )
    );
  });
const getUserBookings = asynchandler(async (req, res) => {
    const userId = req.user._id;
  
    // Find all vehicles where this user has bookings
    const vehicles = await Vehicle.find({
      "bookings.userId": userId,
    })
      .populate("host", "name email")
      .select("scootyModel photos city location bookings");
  
    if (!vehicles.length) {
      return res
        .status(200)
        .json(new apiresponse(200, [], "No bookings found for this user."));
    }
    for (const vehicle of vehicles) {
      await autoCompleteExpiredBookings(vehicle);
    }
    // Flatten all bookings relevant to this user
const userBookings = vehicles.flatMap((vehicle) =>
      vehicle.bookings
        .filter((b) => b.userId.toString() === userId.toString())
        .map((b) => ({
          vehicleId: vehicle._id,
          scootyModel: vehicle.scootyModel,
          photos: vehicle.photos,
          city: vehicle.city,
          location: vehicle.location,
          host: vehicle.host,
          bookingStatus: b.bookingStatus,
          startDate: b.startDate,
          endDate: b.endDate,
          totalPrice: b.totalPrice,
        }))
    );
  
    return res.status(200).json(
      new apiresponse(
        200,
        userBookings,
        "User bookings fetched successfully."
      )
    );
});
const getHostBookings = asynchandler(async (req, res) => {
  const hostId = req.user._id;

  // 1. Find all vehicles owned by this host
  const hostVehicles = await Vehicle.find({ host: hostId }).select(
    "scootyModel photos bookings"
  );

  if (!hostVehicles.length) {
    return res
      .status(200)
      .json(new apiresponse(200, [], "You do not have any vehicles."));
  }
  for (const vehicle of hostVehicles) {
    await autoCompleteExpiredBookings(vehicle);
  }
  // 2. Collect all user IDs from all bookings (all statuses)
  const allUserIds = hostVehicles.flatMap((vehicle) =>
    vehicle.bookings.map((b) => b.userId)
  );
  
  const uniqueUserIds = [...new Set(allUserIds.map(id => id.toString()))];

  // 3. Fetch all unique users in one query
  const renters = await User.find({ _id: { $in: uniqueUserIds } }).select(
    "name email phone profile.photo"
  );

  // 4. Map users by their ID for easy lookup
  const renterMap = new Map(
    renters.map((renter) => [renter._id.toString(), renter])
  );

  // 5. Build the response by combining vehicle and renter data
  const allBookings = hostVehicles.flatMap((vehicle) =>
    vehicle.bookings.map((booking) => {
      const renter = renterMap.get(booking.userId.toString());
      return {
        vehicleId: vehicle._id,
        scootyModel: vehicle.scootyModel,
        vehiclePhotos: vehicle.photos,
        bookingId: booking._id,
        bookingStatus: booking.bookingStatus,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        renterDetails: renter
          ? {
              userId: renter._id,
              name: renter.name,
              email: renter.email,
              phone: renter.phone,
              photo: renter.profile?.photo,
            }
          : {
              userId: booking.userId,
              name: "Unknown User",
            },
      };
    })
  );

  // 6. Sort by creation date (newest first)
  allBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res
    .status(200)
    .json(
      new apiresponse(
        200,
        allBookings,
        "All host bookings fetched successfully."
      )
    );
});

const confirmBookingByHost = asynchandler(async (req, res) => {
  const hostId = req.user._id;
  const { vehicleId, bookingId } = req.params;

  const vehicle = await Vehicle.findOne({ _id: vehicleId, host: hostId });
  if (!vehicle) {
    throw new apierror(404, "Vehicle not found or unauthorized.");
  }

  const bookingToConfirm = vehicle.bookings.id(bookingId);
  if (!bookingToConfirm || bookingToConfirm.bookingStatus !== "pending") {
    throw new apierror(400, "Invalid booking request.");
  }

  const { startDate, endDate } = bookingToConfirm;

  // ✅ Confirm selected booking
  bookingToConfirm.bookingStatus = "confirmed";

  // ❌ Cancel overlapping pending bookings
  vehicle.bookings.forEach((b) => {
    if (
      b._id.toString() !== bookingId &&
      b.bookingStatus === "pending" &&
      startDate < b.endDate &&
      endDate > b.startDate
    ) {
      b.bookingStatus = "canceled";
    }
  });

  await vehicle.save();

  // Update confirmed user status
  const renter = await User.findByIdAndUpdate(
    bookingToConfirm.userId,
    { isBookedVehicle: true },
    { new: true }
  );

  /* ---------- SEND EMAIL TO RENTER ---------- */
  if (renter?.email) {
    await sendRenterBookingConfirmedEmail({
      renterEmail: renter.email,
      renterName: renter.name,
      vehicleModel: vehicle.scootyModel,
      fromDate: bookingToConfirm.startDate.toLocaleDateString(),
      fromTime: bookingToConfirm.startDate.toLocaleTimeString(),
      toDate: bookingToConfirm.endDate.toLocaleDateString(),
      toTime: bookingToConfirm.endDate.toLocaleTimeString(),
      totalPrice: bookingToConfirm.totalPrice,
      hostName: vehicle.hostName || "RideNow Host",
    });
  }

  return res.status(200).json(
    new apiresponse(
      200,
      {},
      "Booking confirmed and renter notified via email."
    )
  );
});
const autoCompleteExpiredBookings = async (vehicle) => {
  const now = new Date();
  let updated = false;

  // Populate host once
  await vehicle.populate("host");

  for (const booking of vehicle.bookings) {
    if (
      booking.bookingStatus === "confirmed" &&
      new Date(booking.endDate) < now
    ) {
      booking.bookingStatus = "completed";
      booking.returnedAt = now;
      updated = true;

      // 🔍 Fetch renter
      const user = await User.findById(booking.userId);
      if (!user) continue;

      console.log("📨 Auto-ending booking → sending emails");

      // 📧 Send email
      await sendBookingEndedEmail({
        renterEmail: user.email,
        renterName: user.name,
        hostEmail: vehicle.host?.email,
        hostName: vehicle.host?.name,
        vehicleModel: vehicle.scootyModel,
        fromDate: booking.startDate.toLocaleDateString(),
        toDate: booking.endDate.toLocaleDateString(),
        totalPrice: booking.totalPrice,
        autoEnded: true,
      });

      // Update renter status
      user.isBookedVehicle = false;
      await user.save();
    }
  }

  if (updated) {
    vehicle.isAvailable = true;
    vehicle.NumberOfBooking = (vehicle.NumberOfBooking || 0) + 1;
    await vehicle.save();
  }
};
const getHostVehicles = asynchandler(async (req, res) => {
  const hostId = req.user._id;

  const vehicles = await Vehicle.find({ host: hostId })
    .select(
      "scootyModel photos isAvailable pickupLocation pricing createdAt"
    )
    .lean();

  return res.status(200).json(
    new apiresponse(
      200,
      vehicles,
      "Host vehicles fetched successfully"
    )
  );
});
export { addVehicle, updateVehicle, searchVehicles, bookVehicle, deleteVehicle ,
    verifyRC,toggleVehicleAvailability,getVehicleDetails,endBooking,getUserBookings,
    getHostBookings,confirmBookingByHost,autoCompleteExpiredBookings,previewVehiclePrice,getHostVehicles
};

