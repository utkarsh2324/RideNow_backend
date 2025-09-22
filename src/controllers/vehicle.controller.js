import { Host } from "../models/host.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/rentuser.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";

const addVehicle = asynchandler(async (req, res) => {
    const { scootyModel, location, availableFrom, availableTo } = req.body;
    // Read the authenticated user/host from req.user
    const hostId = req.user._id;

    if (!req.files || !req.files.photos || !req.files.rc || !req.files.insurance) {
        throw new apierror(400, "Vehicle photos, RC, and Insurance documents are all required.");
    }

    const photoUploadPromises = req.files.photos.map(file => uploadOnCloudinary(file.buffer));
    const rcUploadPromise = uploadOnCloudinary(req.files.rc[0].buffer);
    const insuranceUploadPromise = uploadOnCloudinary(req.files.insurance[0].buffer);

    const [photoResults, rcResult, insuranceResult] = await Promise.all([
        Promise.all(photoUploadPromises),
        rcUploadPromise,
        insuranceUploadPromise
    ]);

    const photoUrls = photoResults.map(result => result.secure_url);

    const vehicle = await Vehicle.create({
        host: hostId,
        scootyModel,
        location,
        availableFrom,
        availableTo,
        photos: photoUrls,
        documents: {
            rc: rcResult.secure_url,
            insurance: insuranceResult.secure_url,
        },
    });

    await Host.findByIdAndUpdate(hostId, { $push: { vehicles: vehicle._id } });

    return res.status(201).json(new apiresponse(201, vehicle, "Vehicle added successfully. Awaiting verification."));
});

const updateVehicle = asynchandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { location, availableFrom, availableTo } = req.body;
    // Read the authenticated user/host from req.user
    const hostId = req.user._id;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new apierror(404, "Vehicle not found");

    if (vehicle.host.toString() !== hostId.toString()) {
        throw new apierror(403, "Forbidden: You are not authorized to update this vehicle");
    }

    if (location) vehicle.location = location;
    if (availableFrom) vehicle.availableFrom = new Date(availableFrom);
    if (availableTo) vehicle.availableTo = new Date(availableTo);

    // Automatically calculate isAvailable based on current date and booking status
    const now = new Date();
    const isWithinGeneralAvailability = now >= vehicle.availableFrom && now <= vehicle.availableTo;
    const hasActiveBooking = vehicle.bookings.some(b => b.bookingStatus === 'confirmed' && now >= b.startDate && now <= b.endDate);
    vehicle.isAvailable = isWithinGeneralAvailability && !hasActiveBooking;

    await vehicle.save({ validateBeforeSave: false });

    return res.status(200).json(new apiresponse(200, vehicle, "Vehicle details updated successfully"));
});

const searchVehicles = asynchandler(async (req, res) => {
    const { location, fromDate, toDate } = req.query;
    if (!location || !fromDate || !toDate) {
        throw new apierror(400, "Location, fromDate, and toDate are required for search.");
    }
    const searchFrom = new Date(fromDate);
    const searchTo = new Date(toDate);
    const query = {
        location: { $regex: location, $options: 'i' },
        isAvailable: true, 
        isVerified: true,
        availableFrom: { $lte: searchFrom }, 
        availableTo: { $gte: searchTo },
        bookings: {
            $not: { 
                $elemMatch: { 
                    bookingStatus: 'confirmed', 
                    startDate: { $lt: searchTo }, 
                    endDate: { $gt: searchFrom } 
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
    // Read the authenticated user/host from req.user
    const hostId = req.user._id;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new apierror(404, "Vehicle not found");

    if (vehicle.host.toString() !== hostId.toString()) {
        throw new apierror(403, "Forbidden: You are not authorized to delete this vehicle");
    }

    await Vehicle.findByIdAndDelete(vehicleId);
    await Host.findByIdAndUpdate(hostId, { $pull: { vehicles: vehicleId } });

    return res.status(200).json(new apiresponse(200, {}, "Vehicle deleted successfully"));
});

export { addVehicle, updateVehicle, searchVehicles, bookVehicle, deleteVehicle };

