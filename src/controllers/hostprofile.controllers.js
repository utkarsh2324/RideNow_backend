import { Host } from "../models/host.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";

const uploadHostProfilePhoto = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Photo file is required");

  // FIX: Read from req.user
  const host = await Host.findById(req.user._id);
  if (!host) throw new apierror(404, "Host not found");

  const uploadResult = await uploadOnCloudinary(req.file.buffer);
  if (!uploadResult) throw new apierror(500, "Photo upload failed");

  if (!host.profile) host.profile = {}; 
  host.profile.photo = uploadResult.secure_url;
  await host.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiresponse(200, { photo: host.profile.photo }, "Profile photo uploaded successfully"));
});

const updateHostBasicInfo = asynchandler(async (req, res) => {
  const { name, dob } = req.body;
  if (!name || !dob) throw new apierror(400, "Name and Date of Birth are required");

  const parsedDob = new Date(dob);
  if (isNaN(parsedDob.getTime())) throw new apierror(400, "Invalid date format for DOB");

  // FIX: Read from req.user
  const host = await Host.findById(req.user._id);
  if (!host) throw new apierror(404, "Host not found");

  host.name = name;
  host.dob = parsedDob;
  await host.save({ validateBeforeSave: false });

  return res.status(200).json(new apiresponse(200, { name: host.name, dob: host.dob }, "Basic info updated successfully"));
});

const updateHostMobileNumber = asynchandler(async (req, res) => {
  const { mobileNumber } = req.body;
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(mobileNumber)) throw new apierror(400, "Invalid Indian mobile number");

  // FIX: Read from req.user
  const host = await Host.findById(req.user._id);
  if (!host) throw new apierror(404, "Host not found");

  host.phone = mobileNumber;
  host.isPhoneVerified = false; 
  await host.save({ validateBeforeSave: false });

  return res.status(200).json(new apiresponse(200, { phone: host.phone, isPhoneVerified: host.isPhoneVerified }, "Mobile number updated. Please verify."));
});

export { uploadHostProfilePhoto, updateHostBasicInfo, updateHostMobileNumber };
