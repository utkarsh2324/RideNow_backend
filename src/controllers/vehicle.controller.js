import { Host } from "../models/host.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/rentuser.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";
import axios from "axios";
import mongoose, { Schema } from "mongoose";

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
    if (!req.file) throw new apierror(400, "RC PDF file is required.");
    const hostId = req.user._id;
  
    const host = await Host.findById(hostId);
    if (!host) throw new apierror(404, "Host not found.");
  
    const rcBlob = new Blob([req.file.buffer], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", rcBlob, "rc.pdf");
  
    const { data } = await axios.post(
      "https://arjun9036-ridenow.hf.space/validate-rc",
      formData,
      {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: "text",
      }
    );
  
    const validation = typeof data === "string" ? data : JSON.stringify(data);
    const normalized = validation.toLowerCase();
  
    if (normalized.includes("✅ rc number".toLowerCase()) && normalized.includes("valid and found")) {
      const uploadResult = await uploadOnCloudinary(req.file.buffer, "pdf");
  
      // ✅ Just return verification info (don’t attach to vehicle yet)
      return res.status(200).json(
        new apiresponse(
          200,
          {
            rcUrl: uploadResult.secure_url,
            validation,
          },
          "✅ RC verified successfully."
        )
      );
    } else {
      return res.status(200).json(
        new apiresponse(200, { validation }, "⚠️ RC not found or invalid.")
      );
    }
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
    const { location } = req.query;
    if (!location ) {
        throw new apierror(400, "Location, fromDate, and toDate are required for search.");
    }
    const query = {
        location: { $regex: location, $options: 'i' },
        isAvailable: true, 
        isVerified: true,
        bookings: {
            $not: { 
                $elemMatch: { 
                    bookingStatus: 'confirmed', 
                } 
            }
        }
    };
    const vehicles = await Vehicle.find(query).populate('host', 'name');
    return res.status(200).json(new apiresponse(200, vehicles, "Available vehicles fetched."));
});

const bookVehicle = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { startDate, endDate, totalPrice } = req.body;
    const userId = req.user._id;
    if (!startDate || !endDate) {
        throw new apierror(400, "Start date and end date are required for booking.");
    }
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new apierror(404, "Vehicle not found.");
    if (!vehicle.isAvailable) throw new apierror(400, "This vehicle is not available for booking at the moment.");
    
    const newBooking = {
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalPrice,
        bookingStatus: 'confirmed'
    };
    vehicle.bookings.push(newBooking);
    await vehicle.save();
    return res.status(200).json(new apiresponse(200, newBooking, "Vehicle booked successfully!"));
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
  
    // ✅ Validate vehicle ID
    if (!vehicleId) {
      throw new apierror(400, "Vehicle ID is required.");
    }
  
    // ✅ Find vehicle and populate host details (optional)
    const vehicle = await Vehicle.findById(vehicleId)
      .populate("host", "name email phone profile.photo")
      .lean();
  
    if (!vehicle) {
      throw new apierror(404, "Vehicle not found.");
    }
  
    // ✅ Create structured response
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
  
    // ✅ Return success response
    return res
      .status(200)
      .json(new apiresponse(200, vehicleDetails, "Vehicle details fetched successfully."));
  });
export { addVehicle, updateVehicle, searchVehicles, bookVehicle, deleteVehicle ,verifyRC,toggleVehicleAvailability,getVehicleDetails};

