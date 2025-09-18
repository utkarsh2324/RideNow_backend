import { User } from "../models/rentuser.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";


const uploadProfilePhoto = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Photo file is required");

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  const uploadResult = await uploadOnCloudinary(req.file.buffer);
  if (!uploadResult) throw new apierror(500, "Photo upload failed");

  user.profile.photo = uploadResult.secure_url;
  await user.save();

  return res
    .status(200)
    .json(new apiresponse(200, { photo: user.profile.photo }, "Profile photo uploaded successfully"));
});
const updateBasicInfo = asynchandler(async (req, res) => {
  const { name, dob } = req.body;

  if (!name || !dob) {
    throw new apierror(400, "Name and Date of Birth are required");
  }

  // Validate DOB format
  const parsedDob = new Date(dob);
  if (isNaN(parsedDob.getTime())) {
    throw new apierror(400, "Invalid date format for DOB");
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  user.name = name;
  user.dob = parsedDob;

  await user.save();

  return res
    .status(200)
    .json(
      new apiresponse(
        200,
        { name: user.profile.name, dob: user.profile.dob },
        "Basic info updated successfully"
      )
    );
});

const updateMobileNumber = asynchandler(async (req, res) => {
  const { mobileNumber } = req.body;

  // ✅ Validate Indian mobile number
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(mobileNumber)) {
    throw new apierror(400, "Invalid Indian mobile number");
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  user.phone = mobileNumber;       // ✅ save to "phone"
  user.isPhoneVerified = true;    // ✅ mark as not verified yet

  await user.save();

  return res.status(200).json(
    new apiresponse(
      200,
      { phone: user.phone, isPhoneVerified: user.isPhoneVerified },
      "Mobile number updated successfully"
    )
  );
});

export { uploadProfilePhoto ,updateBasicInfo,updateMobileNumber};