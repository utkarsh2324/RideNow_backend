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

  // Validate inputs
  if (!email || !password || email.trim() === "" || password.trim() === "") {
    throw new apierror(400, "Email and password are required");
  }

  if (!validator.isEmail(email)) {
    throw new apierror(409, "Invalid email format");
  }

  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new apierror(409, "User already exists");
  }

  // Generate & hash OTP
  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Send OTP via email
  await sendEmail(
    email,
    "Your OTP Code",
    `Your OTP code is ${otp}. It will expire in 10 minutes.`
  );

  // Create user
  const user = await User.create({
    email,
    password,
    otp: hashedOtp,
    otpExpiry,
    isEmailVerified: false,
  });

  return res
    .status(201)
    .json(
      new apiresponse(
        200,
        { userId: user._id, email: user.email },
        "OTP sent to your email. Please verify."
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

  return res
    .status(200)
    .json(
      new apiresponse(
        200,
        null,
        "Email verified successfully. You can now login."
      )
    );
});
// ================= Normal Login =================
const login = asynchandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new apierror(400, "Email and password required");

  const user = await User.findOne({ email, authProvider: "local" });
  if (!user) throw new apierror(404, "User not found");

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) throw new apierror(400, "Invalid password");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save();

  return res
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax", // required for cross-site cookies
      secure: false, // must be false in localhost
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    })
    .status(200)
    .json(new apiresponse(200, user, "Login successful"));
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
      fullName: name, // Note: Web uses fullName
      avatar: picture, // Note: Web uses avatar
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

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax", // required for cross-site cookies
      secure: false, // must be false in localhost
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    })
    .json(
      new apiresponse(200, { user, accessToken }, "User logged in successfully")
    );
});

// ================= Refresh Access Token =================
const refreshAccessToken = asynchandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken; // Note: Reads from cookies
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
    await user.save();
  }

  return res
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
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

  return res.status(200).json(new apiresponse(200, {}, "OTP sent to email"));
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
    .json(
      new apiresponse(
        200,
        { photo: user.profile.photo },
        "Profile photo uploaded successfully"
      )
    );
});

const getCurrentUser = asynchandler(async (req, res) => {
  // remove sensitive fields before sending response
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    return res.status(404).json(new apiresponse(404, null, "User not found"));
  }

  return res
    .status(200)
    .json(new apiresponse(200, user, "Current User fetched successfully"));
});
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
  getCurrentUser
};
