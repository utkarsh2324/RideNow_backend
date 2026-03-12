/**
 * @fileoverview App-specific controllers for vehicles.
 * Handles searching, booking, and managing vehicle data for app users.
 */
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/rentuser.model.js";
import { apiresponse } from "../utils/apiresponse.js";
import { apierror } from "../utils/apierror.js";
import { asynchandler } from "../utils/asynchandler.js";
import { sendBookingEndedEmail } from "../utils/sendBookingEndedEmail.js";
import { calculateBookingPrice } from "../utils/calculateBookingprice.js";
import mongoose from "mongoose";

/**
 * [APP] Search for available vehicles
 * Updated to search by city AND date range.
 */
const searchVehicles = async (req, res) => {
  try {
    const { city, pickup, drop } = req.query;

    if (!city || !pickup || !drop) {
      return res
        .status(400)
        .json(
          new apiresponse(
            400,
            null,
            "City, pickup, and drop times are required."
          )
        );
    }

    const pickupDate = new Date(pickup);
    const dropDate = new Date(drop);

    // Robustly split the search string into words for partial regex matching
    const locationParts = city
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((part) => new RegExp(part, "i"));

    // Find vehicles that are verified, available, and match the city or location.
    // Most importantly, check for booking conflicts.
    const vehicles = await Vehicle.find({
      isAvailable: true,
      isVerified: true,
      $or: [
        { city: { $in: locationParts } },
        { location: { $in: locationParts } },
        { "pickupLocation.city": { $in: locationParts } },
        { "pickupLocation.address": { $in: locationParts } }
      ],

      // $nor = no bookings exist that...
      $nor: [
        {
          "bookings.bookingStatus": "confirmed",
          // ...overlap with the requested time window
          $or: [
            // 1. A booking starts during the requested period
            { "bookings.startDate": { $gte: pickupDate, $lt: dropDate } },
            // 2. A booking ends during the requested period
            { "bookings.endDate": { $gt: pickupDate, $lte: dropDate } },
            // 3. A booking surrounds the requested period
            {
              "bookings.startDate": { $lte: pickupDate },
              "bookings.endDate": { $gte: dropDate },
            },
          ],
        },
      ],
    }).populate("host", "name profile.photo"); // Populate host name/photo

    if (!vehicles.length) {
      return res
        .status(200)
        .json(
          new apiresponse(200, [], "No vehicles found matching your criteria.")
        );
    }

    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          vehicles,
          "Available vehicles fetched successfully."
        )
      );
  } catch (error) {
    console.error("APP SEARCH VEHICLES FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

/**
 * [APP] Get details for a single vehicle
 */
const getVehicleDetails = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    if (!vehicleId) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Vehicle ID is required."));
    }

    const vehicle = await Vehicle.findById(vehicleId)
      .populate("host", "name email phone profile.photo")
      .lean();

    if (!vehicle) {
      return res
        .status(404)
        .json(new apiresponse(404, null, "Vehicle not found."));
    }

    // Omit sensitive data if needed, but for now, we'll return as is
    return res
      .status(200)
      .json(
        new apiresponse(200, vehicle, "Vehicle details fetched successfully.")
      );
  } catch (error) {
    console.error("APP GET VEHICLE DETAILS FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

/**
 * [APP] Book a vehicle
 */
const bookVehicle = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, totalPrice } = req.body;
    const userId = req.user._id;

    if (!startDate || !endDate || !totalPrice) {
      return res
        .status(400)
        .json(
          new apiresponse(
            400,
            null,
            "Start date, end date, and total price are required."
          )
        );
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error("User not found.");
    }
    if (user.isBookedVehicle === true) {
      return res
        .status(400)
        .json(
          new apiresponse(400, null, "You already have an active booking.")
        );
    }
    if (!user.isDocVerified) {
      return res
        .status(403)
        .json(
          new apiresponse(
            403,
            null,
            "You must verify your documents before booking."
          )
        );
    }

    const vehicle = await Vehicle.findById(vehicleId).session(session);
    if (!vehicle) {
      throw new Error("Vehicle not found.");
    }
    if (!vehicle.isAvailable) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "This vehicle is not available."));
    }

    // (Add the date conflict check here again, just to be safe)

    const newBooking = {
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalPrice,
      bookingStatus: "confirmed",
      createdAt: new Date(),
    };

    vehicle.bookings.push(newBooking);
    vehicle.isAvailable = false; // Mark as booked
    user.isBookedVehicle = true; // Mark user as having a booking

    await vehicle.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    return res
      .status(200)
      .json(new apiresponse(200, newBooking, "Vehicle booked successfully!"));
  } catch (error) {
    await session.abortTransaction();
    console.error("APP BOOK VEHICLE FAILED:", error);
    return res
      .status(500)
      .json(
        new apiresponse(
          500,
          null,
          error.message || "Booking failed. Please try again."
        )
      );
  } finally {
    session.endSession();
  }
};

/**
 * [APP] Get all bookings for the current user (FIXED)
 * This logic is now identical to your working web controller.
 */
const getAppUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;

    // --- LOGIC COPIED EXACTLY FROM vehicle.controller.js ---
    const vehicles = await Vehicle.find({
      "bookings.userId": userId,
    })
      .populate("host", "name email") // Using exact populate from your web file
      .select("scootyModel photos city location bookings host"); // Selecting host

    if (!vehicles || vehicles.length === 0) {
      return res
        .status(200)
        .json(new apiresponse(200, [], "No bookings found for this user."));
    }

    const userBookings = vehicles.flatMap((vehicle) => {
      // Add my safety checks (this is the only improvement)
      if (!vehicle.bookings || !Array.isArray(vehicle.bookings)) {
        return [];
      }
      return vehicle.bookings
        .filter(
          (b) => b && b.userId && b.userId.toString() === userId.toString()
        )
        .map((b) => ({
          vehicleId: vehicle._id,
          scootyModel: vehicle.scootyModel,
          photos: vehicle.photos,
          city: vehicle.city,
          location: vehicle.location,
          host: vehicle.host, // This is the populated object
          bookingStatus: b.bookingStatus,
          startDate: b.startDate,
          endDate: b.endDate,
          totalPrice: b.totalPrice,
          bookingId: b._id,
        }));
    });
    // --- END OF COPIED LOGIC ---

    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          userBookings,
          "User bookings fetched successfully."
        )
      );
  } catch (error) {
    // This will catch any error (including a failed .populate())
    console.error("APP GET USER BOOKINGS FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

/**
 * [APP] End a booking — matches website logic
 */
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
  try {
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
  } catch (emailErr) {
    console.error("Email sending failed (non-fatal):", emailErr.message);
  }

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

/**
 * [APP] Preview vehicle price — matches website logic (local calculation, no FastAPI)
 */
const previewVehiclePrice = asynchandler(async (req, res) => {
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
});

export {
  searchVehicles,
  getVehicleDetails,
  bookVehicle,
  getAppUserBookings,
  endBooking,
  previewVehiclePrice,
};

