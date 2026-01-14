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

const addVehicle = asynchandler(async (req, res) => {
    const { scootyModel, location, city} = req.body;
    // Read the authenticated user/host from req.user
    const hostId = req.user._id;

    if (!req.files || !req.files.photos || !req.files.rc ||!city) {
        throw new apierror(400, "Vehicle photos, RC, and Insurance documents are all required.");
    }

    const photoUploadPromises = req.files.photos.map(file => uploadOnCloudinary(file.buffer));
    const rcUploadPromise = uploadOnCloudinary(req.files.rc[0].buffer);
    

    const [photoResults, rcResult] = await Promise.all([
        Promise.all(photoUploadPromises),
        rcUploadPromise
    ]);

    const photoUrls = photoResults.map(result => result.secure_url);

    const vehicle = await Vehicle.create({
        host: hostId,
        scootyModel,
        location,
        photos: photoUrls,
        documents: {
            rc: rcResult.secure_url,
           
        },
        city,
        isVerified:true
    });

    await Host.findByIdAndUpdate(hostId, { $push: { vehicles: vehicle._id } });

    return res.status(201).json(new apiresponse(201, vehicle, "Vehicle added successfully. Awaiting verification."));
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
    const { location } = req.body;
    // Read the authenticated user/host from req.user
    const hostId = req.user._id;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new apierror(404, "Vehicle not found");

    if (vehicle.host.toString() !== hostId.toString()) {
        throw new apierror(403, "Forbidden: You are not authorized to update this vehicle");
    }

    if (location) vehicle.location = location;
   

    // Automatically calculate isAvailable based on current date and booking status

    await vehicle.save({ validateBeforeSave: false });

    return res.status(200).json(new apiresponse(200, vehicle, "Vehicle details updated successfully"));
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
    const { location, fromDate, toDate, fromTime, toTime } = req.query;
  
    if (!location || !fromDate || !toDate || !fromTime || !toTime) {
      throw new apierror(400, "Location, date and time are required.");
    }
  
    const requestedStart = new Date(
      new Date(`${fromDate}T${fromTime}:00`).toISOString()
    );
    const requestedEnd = new Date(
      new Date(`${toDate}T${toTime}:00`).toISOString()
    );
  
    if (requestedStart >= requestedEnd) {
      throw new apierror(400, "Invalid date/time range.");
    }
  
    const locationParts = location
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((part) => new RegExp(part, "i"));
  
    const vehicles = await Vehicle.find({
      isVerified: true,
      isAvailable: true,
      $or: [
        { location: { $in: locationParts } },
        { city: { $in: locationParts } },
      ],
      bookings: {
        $not: {
          $elemMatch: {
            bookingStatus: "confirmed",
            startDate: { $lt: requestedEnd },
            endDate: { $gt: requestedStart },
          },
        },
      },
    }).populate("host", "name email");
  
    return res.status(200).json(
      new apiresponse(200, vehicles, "Available vehicles fetched successfully.")
    );
  });
const bookVehicle = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { fromDate, toDate, fromTime, toTime, totalPrice } = req.body;
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
  
    // ❌ Check only confirmed bookings
    const conflict = vehicle.bookings.some(
      (b) =>
        b.bookingStatus === "confirmed" &&
        startDate < b.endDate &&
        endDate > b.startDate
    );
  
    if (conflict) {
      throw new apierror(400, "Vehicle already booked for this slot.");
    }
  
    // ✅ Create pending booking
    vehicle.bookings.push({
      userId,
      startDate,
      endDate,
      totalPrice,
      bookingStatus: "pending",
    });
  
    await vehicle.save();
  
    /* ---------------- SEND SMS TO HOST ---------------- */
  
    if (vehicle.host?.phone) {
      const message = `
  🚲 RideNow Booking Alert
  
  You have a new booking request!
  
  Vehicle: ${vehicle.scootyModel}
  From: ${fromDate} ${fromTime}
  To: ${toDate} ${toTime}
  
  Please login to RideNow to approve or reject.
      `;
  
      await sendSMS(vehicle.host.phone, message);
    }
  
    return res.status(200).json(
      new apiresponse(
        200,
        {},
        "Booking request sent. Host has been notified."
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
      location: vehicle.location,
      photos: vehicle.photos,
      rcDocument: vehicle.documents?.rc,
      isVerified: vehicle.isVerified,
      isAvailable: vehicle.isAvailable,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      host: {
        _id: vehicle.host?._id || null,
        name: vehicle.host?.name || "Unknown",
        email: vehicle.host?.email || "Not provided",
        phone: vehicle.host?.phone || "Not provided",
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
  
    const vehicle = await Vehicle.findById(vehicleId);
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
          ? "Booking automatically ended due to passed end date."
          : "Booking ended successfully."
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
  await User.findByIdAndUpdate(bookingToConfirm.userId, {
    isBookedVehicle: true,
  });

  return res.status(200).json(
    new apiresponse(
      200,
      {},
      "Booking confirmed. Other overlapping requests rejected."
    )
  );
});
const autoCompleteExpiredBookings = async (vehicle) => {
  let updated = false;
  const now = new Date();

  vehicle.bookings.forEach((b) => {
    if (
      b.bookingStatus === "confirmed" &&
      new Date(b.endDate) < now
    ) {
      b.bookingStatus = "completed";
      b.returnedAt = now;
      updated = true;
    }
  });

  if (updated) {
    vehicle.isAvailable = true;
    await vehicle.save();
  }
};
export { addVehicle, updateVehicle, searchVehicles, bookVehicle, deleteVehicle ,
    verifyRC,toggleVehicleAvailability,getVehicleDetails,endBooking,getUserBookings,
    getHostBookings,confirmBookingByHost,autoCompleteExpiredBookings
};

