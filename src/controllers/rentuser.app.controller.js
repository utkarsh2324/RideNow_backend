/**
 * @fileoverview App-specific controllers for User Authentication and Documents.
 *
 * These functions are designed for the RideNow mobile app.
 * They use 'try...catch' blocks for error handling and
 * return JSON-formatted 'apiresponse' objects on all paths.
 */

import { User } from "../models/rentuser.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { apiresponse } from "../utils/apiresponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import validator from "validator";
import { generateOtp } from "../utils/generateotp.js";
import { sendEmail } from "../utils/sendemail.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ================= Normal SignUp =================
const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || email.trim() === "" || password.trim() === "") {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Email and password are required"));
    }
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Invalid email format"));
    }
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(409)
        .json(
          new apiresponse(409, null, "User with this email already exists")
        );
    }
    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    await sendEmail(
      email,
      "Your OTP Code",
      `Your OTP code is ${otp}. It will expire in 10 minutes.`
    );
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
          201,
          { userId: user._id },
          "OTP sent. Please verify your email."
        )
      );
  } catch (error) {
    console.error("APP REGISTER USER FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= OTP Verification =================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Email and OTP are required"));
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }
    if (user.isEmailVerified) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Email is already verified"));
    }
    if (!user.otp || !user.otpExpiry || user.otpExpiry < Date.now()) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "OTP is invalid or has expired"));
    }
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Invalid OTP provided"));
    }
    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          null,
          "Email verified successfully. You can now login."
        )
      );
  } catch (error) {
    console.error("APP VERIFY OTP FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Normal Login =================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Email and password are required"));
    }
    const user = await User.findOne({ email, authProvider: "local" });
    if (!user) {
      return res
        .status(404)
        .json(new apiresponse(404, null, "User not found with this email"));
    }
    if (!user.isEmailVerified) {
      return res
        .status(403)
        .json(
          new apiresponse(
            403,
            null,
            "Please verify your email before logging in."
          )
        );
    }
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      return res
        .status(401)
        .json(new apiresponse(401, null, "Invalid user credentials"));
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -otp"
    );
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const responseData = { user: loggedInUser, accessToken, refreshToken };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new apiresponse(200, responseData, "Login successful"));
  } catch (error) {
    console.error("APP LOGIN FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Google OAuth Login/Signup =================
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Google token is required"));
    }
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name, picture, sub: googleId } = ticket.getPayload();
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name,
        profile: { photo: picture },
        googleId: googleId,
        authProvider: "google",
        isEmailVerified: true,
      });
    } else if (user.authProvider !== "google") {
      return res
        .status(409)
        .json(
          new apiresponse(
            409,
            null,
            "This email is registered with a password. Please log in using your password."
          )
        );
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -otp"
    );
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const responseData = { user: loggedInUser, accessToken, refreshToken };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new apiresponse(200, responseData, "Google login successful"));
  } catch (error) {
    console.error("APP GOOGLE LOGIN FAILED:", error);
    return res
      .status(500)
      .json(
        new apiresponse(
          500,
          null,
          "An internal server error occurred during Google login"
        )
      );
  }
};

// ================= Logout =================
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { refreshToken: undefined } },
      { new: true }
    );
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new apiresponse(200, {}, "Logged out successfully"));
  } catch (error) {
    console.error("APP LOGOUT FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Refresh Access Token =================
const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
      return res
        .status(401)
        .json(new apiresponse(401, null, "No refresh token provided"));
    }
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== incomingRefreshToken) {
      return res
        .status(403)
        .json(new apiresponse(403, null, "Invalid refresh token"));
    }
    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    return res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiresponse(
          200,
          { accessToken: newAccessToken, refreshToken: newRefreshToken },
          "Token refreshed"
        )
      );
  } catch (error) {
    console.error("APP REFRESH TOKEN FAILED:", error);
    return res
      .status(403)
      .json(new apiresponse(403, null, "Invalid or expired refresh token"));
  }
};

// ================= Forgot Password =================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Email is required"));
    }
    const user = await User.findOne({ email, authProvider: "local" });
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 15 * 60 * 1000;
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpPurpose = "forgot";
    await user.save({ validateBeforeSave: false });
    await sendEmail(user.email, "Password Reset OTP", `Your OTP is ${otp}`);
    return res.status(200).json(new apiresponse(200, {}, "OTP sent to email"));
  } catch (error) {
    console.error("APP FORGOT PASSWORD FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Reset Password =================
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json(
          new apiresponse(400, null, "Email, OTP and new password are required")
        );
    }
    const user = await User.findOne({ email, authProvider: "local" });
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }
    if (user.otp !== otp || Date.now() > user.otpExpiry) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Invalid or expired OTP"));
    }
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = undefined;
    await user.save();
    return res
      .status(200) // --- FIX was .status(2all) ---
      .json(new apiresponse(200, {}, "Password reset successful"));
  } catch (error) {
    console.error("APP RESET PASSWORD FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Change Password =================
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Old and new password are required"));
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }
    const isMatch = await user.isPasswordCorrect(oldPassword);
    if (!isMatch) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Old password is incorrect"));
    }
    user.password = newPassword;
    await user.save();
    return res
      .status(200)
      .json(new apiresponse(200, {}, "Password changed successfully"));
  } catch (error) {
    console.error("APP CHANGE PASSWORD FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Upload Profile Photo =================
// Note: This function is also in rentuserprofile.app.controller.js
// It should ideally be in only one place, but we'll include it here
// as your code expects it.
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Photo file is required"));
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }

    // Use req.file.buffer for consistency
    const uploadResult = await uploadOnCloudinary(req.file.buffer);
    if (!uploadResult) {
      return res
        .status(500)
        .json(new apiresponse(500, null, "Photo upload failed"));
    }
    user.profile.photo = uploadResult.secure_url;
    await user.save({ validateBeforeSave: false });
    return res
      .status(200) // --- FIX was .status(2all) ---
      .json(
        new apiresponse(
          200,
          { photo: user.profile.photo },
          "Profile photo uploaded successfully"
        )
      );
  } catch (error) {
    console.error("APP UPLOAD PHOTO FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

// ================= Get Current User =================
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -refreshToken -otp"
    );
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }
    return res
      .status(200)
      .json(new apiresponse(200, user, "Current user fetched successfully"));
  } catch (error) {
    console.error("APP GET CURRENT USER FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "An internal server error occurred"));
  }
};

//
// =================================================================
// 3. APP-SPECIFIC DOCUMENT VERIFICATION FUNCTIONS
//    Matches website logic: upload to Cloudinary, mark as pending.
// =================================================================
//

/**
 * 🔹 Upload Aadhar PDF and save to Cloudinary (APP)
 *    No external FastAPI validation — just upload and mark pending.
 */
const verifyAadhar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(new apiresponse(400, null, "Aadhar PDF file is required"));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }

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
  } catch (error) {
    console.error("APP VERIFY AADHAR FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "Internal Server Error"));
  }
};

/**
 * 🔹 Upload Driving Licence PDF and save to Cloudinary (APP)
 *    No external FastAPI validation — just upload and mark pending.
 */
const verifyDL = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(
          new apiresponse(400, null, "Driving Licence PDF file is required")
        );
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }

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
  } catch (error) {
    console.error("APP VERIFY DL FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "Internal Server Error"));
  }
};

/**
 * 🔹 Get all uploaded document statuses for the user (APP)
 * Note: This function returns raw JSON, not an 'apiresponse' object,
 * to match the web controller's behavior.
 */
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

// ================= Accept Terms & Conditions =================
const acceptTermsAndConsent = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json(new apiresponse(401, null, "Unauthorized"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new apiresponse(404, null, "User not found"));
    }

    // Already accepted → idempotent
    if (user.termsConsent?.accepted) {
      return res.status(200).json(
        new apiresponse(200, user.termsConsent, "Terms already accepted")
      );
    }

    user.termsConsent = {
      accepted: true,
      acceptedAt: new Date(),
      version: "v1.0",
    };

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
      new apiresponse(
        200,
        user.termsConsent,
        "Terms & Conditions accepted successfully"
      )
    );
  } catch (error) {
    console.error("APP ACCEPT TERMS FAILED:", error);
    return res
      .status(500)
      .json(new apiresponse(500, null, "Internal Server Error"));
  }
};

// 4. Export all functions, including new ones
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
  verifyDL,
  getDocuments,
  acceptTermsAndConsent,
};
