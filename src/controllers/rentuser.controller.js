import { User } from "../models/rentuser.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import validator from "validator";
import { generateOtp } from "../utils/generateotp.js";
import { sendEmail } from "../utils/sendemail.js";
import axios from "axios";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// ================= Normal SignUp=================
const registerUser = asynchandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new apierror(400, "Email and password are required");
  }

  if (!validator.isEmail(email)) {
    throw new apierror(409, "Invalid email format");
  }

  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new apierror(409, "User already exists");
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = Date.now() + 10 * 60 * 1000;

  await sendEmail({
    to: email,
    subject: "Your RideNow OTP",
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <h2>RideNow Verification</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });

  const user = await User.create({
    email,
    password,
    otp: hashedOtp,
    otpExpiry,
    isEmailVerified: false,
  });

  return res.status(201).json(
    new apiresponse(
      200,
      { userId: user._id, email: user.email },
      "OTP sent to email"
    )
  );
});

const verifyOtp = asynchandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new apierror(400, "Email and OTP are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new apierror(404, "User not found");
  }

  if (!user.otp || !user.otpExpiry) {
    throw new apierror(400, "OTP not requested");
  }

  if (user.otpExpiry < Date.now()) {
    throw new apierror(400, "OTP has expired");
  }

  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) {
    throw new apierror(400, "Invalid OTP");
  }

  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res.status(200).json(
    new apiresponse(200, null, "Email verified successfully. You can now login.")
  );
});
// ================= Normal Login =================
const login = asynchandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new apierror(400, "Email and password required");

  const user = await User.findOne({ email, authProvider: "local" });
  if (!user) throw new apierror(404, "User not found");

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) throw new apierror(400, "Invalid password");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save();
  const isProduction = process.env.NODE_ENV === "production";

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax", // ✅ 'none' for production, 'lax' for localhost
      secure: isProduction, // ✅ true only in production (HTTPS)
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    })
    .json(
      new apiresponse(
        200,
        { user, accessToken },
        "User logged in successfully"
      )
    );
});


// ================= Google OAuth Login/Signup =================

const googleLogin = asynchandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    throw new apierror(400, "Google token is required");
  }

  // Verify the token using the initialized client
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { email, name, picture, sub: googleId } = ticket.getPayload();

  // Find or create the user in your database
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      fullName: name,
      avatar: picture,
      googleId: googleId,
      authProvider: "google",
      isEmailVerified: true,
    });
  }

  // --- The rest of your logic to generate tokens and send cookies ---
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  const isProduction = process.env.NODE_ENV === "production";

return res
  .status(200)
  .cookie("accessToken", accessToken, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax", // ✅ 'none' for production, 'lax' for localhost
    secure: isProduction, // ✅ true only in production (HTTPS)
  })
  .cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  })
  .json(
    new apiresponse(
      200,
      { user, accessToken },
      "User logged in successfully"
    )
  );
});

// ================= Refresh Access Token =================
const refreshAccessToken = asynchandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new apierror(401, "No refresh token provided");

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findById(decoded._id);
  if (!user || user.refreshToken !== refreshToken) {
    throw new apierror(403, "Invalid refresh token");
  }

  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.refreshToken = newRefreshToken;
  await user.save();

  return res
    .cookie("accessToken", newAccessToken, { httpOnly: true })
    .cookie("refreshToken", newRefreshToken, { httpOnly: true })
    .status(200)
    .json(new apiresponse(200, {}, "Token refreshed"));
});

// ================= Logout =================
const logout = asynchandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }

  // 👇 Match the cookie options used in login
  const cookieOptions = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .status(200)
    .json(new apiresponse(200, {}, "Logged out successfully"));
});

// ================= Forgot Password =================
const forgotPassword = asynchandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new apierror(400, "Email is required");

  const user = await User.findOne({ email, authProvider: "local" });
  if (!user) throw new apierror(404, "User not found");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = Date.now() + 15 * 60 * 1000;

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  user.otpPurpose = "forgot";
  await user.save({ validateBeforeSave: false });

  await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}`);

  return res
    .status(200)
    .json(new apiresponse(200, {}, "OTP sent to email"));
});

// ================= Reset Password =================
const resetPassword = asynchandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    throw new apierror(400, "Email, OTP and new password are required");

  const user = await User.findOne({ email, authProvider: "local" });
  if (!user) throw new apierror(404, "User not found");

  if (user.otp !== otp || Date.now() > user.otpExpiry) {
    throw new apierror(400, "Invalid or expired OTP");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpPurpose = undefined;
  await user.save();

  return res
    .status(200)
    .json(new apiresponse(200, {}, "Password reset successful"));
});

// ================= Change Password =================
const changePassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    throw new apierror(400, "Old and new password are required");

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  const isMatch = await user.isPasswordCorrect(oldPassword);
  if (!isMatch) throw new apierror(400, "Old password is incorrect");

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res
    .status(200)
    .json(new apiresponse(200, {}, "Password changed successfully"));
});
const uploadProfilePhoto = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Photo file is required");

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  const uploadResult = await uploadOnCloudinary(req.file.path);
  if (!uploadResult) throw new apierror(500, "Photo upload failed");

  user.profile.photo = uploadResult.secure_url;
  await user.save();

  return res
    .status(200)
    .json(new apiresponse(200, { photo: user.profile.photo }, "Profile photo uploaded successfully"));
});
const getCurrentUser = asynchandler(async (req, res) => {
  // remove sensitive fields before sending response
  const user = await User.findById(req.user._id).select("-password -refreshToken");

  if (!user) {
    return res
      .status(404)
      .json(new apiresponse(404, null, "User not found"));
  }

  return res
    .status(200)
    .json(new apiresponse(200, user, "Current User fetched successfully"));
});
/**
 * 🔹 Verify Aadhar PDF via FastAPI and upload if valid
 */
const verifyAadhar = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Aadhar PDF file is required");

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  // 🔹 Upload directly to Cloudinary
  const uploadResult = await uploadOnCloudinary(req.file.buffer, "pdf");

  // 🔹 Check if Aadhaar already exists
  const existingIndex = user.verifiedDoc.findIndex(
    (doc) => doc.docType === "Aadhar"
  );

  if (existingIndex !== -1) {
    user.verifiedDoc[existingIndex].docUrl = uploadResult.secure_url;
    user.verifiedDoc[existingIndex].status = "pending";
  } else {
    user.verifiedDoc.push({
      docType: "Aadhar",
      docUrl: uploadResult.secure_url,
      status: "pending",
    });
  }

  // ❌ Do NOT auto verify
  user.isDocVerified = false;

  await user.save();

  return res.status(200).json(
    new apiresponse(
      200,
      {
        docType: "Aadhar",
        docUrl: uploadResult.secure_url,
        status: "pending",
      },
      "📄 Aadhaar uploaded successfully. Verification pending."
    )
  );
});
/**
 * 🔹 Verify Driving Licence (DL) PDF via FastAPI and upload if valid
 */
const verifyDL = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Driving Licence PDF file is required");

  const user = await User.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");

  // 🔹 Upload directly to Cloudinary
  const uploadResult = await uploadOnCloudinary(req.file.buffer, "pdf");

  // 🔹 Check if DL already exists
  const existingIndex = user.verifiedDoc.findIndex(
    (doc) => doc.docType === "DL"
  );

  if (existingIndex !== -1) {
    user.verifiedDoc[existingIndex].docUrl = uploadResult.secure_url;
    user.verifiedDoc[existingIndex].status = "pending";
  } else {
    user.verifiedDoc.push({
      docType: "DL",
      docUrl: uploadResult.secure_url,
      status: "pending",
    });
  }

  // ❌ Do NOT auto verify
  user.isDocVerified = false;

  await user.save();

  return res.status(200).json(
    new apiresponse(
      200,
      {
        docType: "DL",
        docUrl: uploadResult.secure_url,
        status: "pending",
      },
      "📄 Driving Licence uploaded successfully. Verification pending."
    )
  );
});
const getDocuments = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const user = await User.findById(userId).select("verifiedDoc");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Separate Aadhar and DL from verifiedDoc array
    const aadharDoc = user.verifiedDoc.find((doc) => doc.docType === "Aadhar");
    const dlDoc = user.verifiedDoc.find((doc) => doc.docType === "DL");

    res.status(200).json({
      success: true,
      documents: {
        aadhar: aadharDoc?.docUrl || null,
        aadharStatus: aadharDoc?.status || "pending",
        dl: dlDoc?.docUrl || null,
        dlStatus: dlDoc?.status || "pending",
      },
    });
  } catch (error) {
    console.error("❌ Error fetching documents:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching documents",
    });
  }
};

export {
  uploadProfilePhoto,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  registerUser,
  verifyOtp,
  getCurrentUser,
  verifyAadhar,
  verifyDL,getDocuments
};