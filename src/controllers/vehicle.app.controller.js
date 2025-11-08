/**
 * @fileoverview App-specific controllers for vehicles.
 * Handles searching, booking, and managing vehicle data for app users.
 */
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/rentuser.model.js";
import { apiresponse } from "../utils/apiresponse.js";
import mongoose from "mongoose";
import axios from "axios";

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

    // Find vehicles that are verified, available, and match the city.
    // Most importantly, check for booking conflicts.
    const vehicles = await Vehicle.find({
      isAvailable: true,
      isVerified: true,
      city: new RegExp(city.split(",")[0], "i"), // Search by city name

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
 * [APP] End a booking
 */
const endBooking = async (req, res) => {
  // This logic is complex and can be kept the same, just wrapped
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const { vehicleId } = req.params;
    const now = new Date();

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found.");

    const vehicle = await Vehicle.findById(vehicleId).session(session);
    if (!vehicle) throw new Error("Vehicle not found.");

    const activeBooking = vehicle.bookings.find(
      (b) =>
        b.bookingStatus === "confirmed" &&
        b.userId.toString() === userId.toString()
    );

    if (!activeBooking) {
      return res
        .status(404)
        .json(new apiresponse(404, null, "No active booking found."));
    }

    activeBooking.bookingStatus = "Completed";
    activeBooking.endDate = now;
    vehicle.isAvailable = true;
    user.isBookedVehicle = false;

    await user.save({ session });
    await vehicle.save({ session });

    await session.commitTransaction();
    return res
      .status(200)
      .json(new apiresponse(200, activeBooking, "Booking ended successfully."));
  } catch (error) {
    await session.abortTransaction();
    console.error("APP END BOOKING FAILED:", error);
    return res
      .status(500)
      .json(
        new apiresponse(500, null, error.message || "Failed to end booking.")
      );
  } finally {
    session.endSession();
  }
};

/**
 * [APP] Get Vehicle Details AND Dynamic Price
 * Fetches vehicle data and calls FastAPI to get the price.
 */
const getVehiclePrice = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { pickup, drop } = req.query; // Get dates from query

    if (!vehicleId || !pickup || !drop) {
      return res
        .status(400)
        .json(
          new apiresponse(
            400,
            null,
            "Vehicle ID, pickup, and drop times are required."
          )
        );
    }

    // 1. Fetch Vehicle Details from our DB
    const vehicle = await Vehicle.findById(vehicleId)
      .populate("host", "name email phone profile.photo")
      .lean(); // .lean() for a plain object

    if (!vehicle) {
      return res
        .status(404)
        .json(new apiresponse(404, null, "Vehicle not found."));
    }

    // 2. Build Payload for FastAPI (based on your web app code)
    // Helper function to format as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split("T")[0];

    const payload = {
      city: vehicle.city || vehicle.location?.split(",")[0] || "Vijayawada",
      model: vehicle.scootyModel,
      vehicle_type: "Scooter",
      fuel_type: "Petrol",
      start_date: formatDate(new Date(pickup)), // <-- FIX
      end_date: formatDate(new Date(drop)), // <-- FIX
    };

    // 3. Call FastAPI Pricing Model
    const { data: priceData } = await axios.post(
      "https://arjun9036-pricingmodel.hf.space/predict",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    // 4. Combine and return everything
    const response = {
      vehicleDetails: vehicle,
      pricingDetails: priceData,
    };

    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          response,
          "Vehicle and price fetched successfully."
        )
      );
  } catch (error) {
    console.error(
      "APP GET VEHICLE PRICE FAILED:",
      error.response ? error.response.data : error.message
    );
    return res
      .status(500)
      .json(new apiresponse(500, null, "Failed to fetch vehicle pricing."));
  }
};

export {
  searchVehicles,
  getVehicleDetails,
  bookVehicle,
  getAppUserBookings,
  endBooking,
  getVehiclePrice,
};
