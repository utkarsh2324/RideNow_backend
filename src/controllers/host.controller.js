import { Host } from "../models/host.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";
import { generateOtp } from "../utils/generateotp.js";
import { sendEmail } from "../utils/sendemail.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import axios from "axios";
import validator from "validator";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerHost = asynchandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || !validator.isEmail(email)) {
    throw new apierror(400, "Valid email and password are required");
  }
  const existedHost = await Host.findOne({ email });
  if (existedHost) {
    throw new apierror(409, "Host with this email already exists");
  }
  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  await sendEmail(email, "Your OTP Code", `Your OTP code is ${otp}. It will expire in 10 minutes.`);
  const host = await Host.create({ email, password, otp: hashedOtp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) });
  return res.status(201).json(new apiresponse(200, { hostId: host._id }, "OTP sent to your email. Please verify."));
});

const verifyHostOtp = asynchandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw new apierror(400, "Email and OTP are required");
    const host = await Host.findOne({ email });
    if (!host) throw new apierror(404, "Host not found");
    if (!host.otp || host.otpExpiry < Date.now()) throw new apierror(400, "OTP is invalid or has expired");
    const isMatch = await bcrypt.compare(otp, host.otp);
    if (!isMatch) throw new apierror(400, "Invalid OTP");
    host.isEmailVerified = true;
    host.otp = undefined;
    host.otpExpiry = undefined;
    await host.save();
    return res.status(200).json(new apiresponse(200, {}, "Email verified successfully."));
});

const loginHost = asynchandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new apierror(400, "Email and password required");
    const host = await Host.findOne({ email });
    if (!host) throw new apierror(404, "Host not found");
    const isPasswordCorrect = await host.isPasswordCorrect(password);
    if (!isPasswordCorrect) throw new apierror(400, "Invalid credentials");
    const accessToken = host.generateAccessToken();
    const refreshToken = host.generateRefreshToken();
    host.refreshToken = refreshToken;
    await host.save({ validateBeforeSave: false });
    return res
      .status(200)
      .cookie("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: 'none' })
      .cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: 'none' })
      .json(new apiresponse(200, { host, accessToken }, "Host login successful"));
});

const googleLoginHost = asynchandler(async (req, res) => {
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
  let user = await Host.findOne({ email });

  if (!user) {
    user = await Host.create({
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

const logoutHost = asynchandler(async (req, res) => {
  await Host.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: null }
  });

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

const refreshHostAccessToken = asynchandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if (!incomingRefreshToken) throw new apierror(401, "Unauthorized request");
    const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const host = await Host.findById(decoded._id);
    if (!host || incomingRefreshToken !== host.refreshToken) throw new apierror(403, "Invalid refresh token");
    const accessToken = host.generateAccessToken();
    return res.status(200)
      .cookie("accessToken", accessToken, { httpOnly: true, secure: true })
      .json(new apiresponse(200, { accessToken }, "Access token refreshed"));
});

const changeHostPassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) throw new apierror(400, "Old and new password are required");

  const host = await Host.findById(req.user._id);
  if (!host) throw new apierror(404, "Host not found");

  const isMatch = await host.isPasswordCorrect(oldPassword);
  if (!isMatch) throw new apierror(400, "Old password is incorrect");

  host.password = newPassword; // The pre-save hook will hash it
  await host.save();

  return res.status(200).json(new apiresponse(200, {}, "Password changed successfully"));
});

const forgotHostPassword = asynchandler(async (req, res) => {
    const { email } = req.body;
    if (!email) throw new apierror(400, "Email is required");
    const host = await Host.findOne({ email });
    if (!host) throw new apierror(404, "Host not found");
    const otp = generateOtp();
    host.otp = otp;
    host.otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await host.save({ validateBeforeSave: false });
    await sendEmail(host.email, "Password Reset OTP", `Your OTP is ${otp}`);
    return res.status(200).json(new apiresponse(200, {}, "OTP sent to email"));
});

const resetHostPassword = asynchandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw new apierror(400, "All fields are required");
    const host = await Host.findOne({ email });
    if (!host) throw new apierror(404, "Host not found");
    if (host.otp !== otp || Date.now() > host.otpExpiry) throw new apierror(400, "Invalid or expired OTP");
    host.password = newPassword;
    host.otp = undefined;
    host.otpExpiry = undefined;
    await host.save();
    return res.status(200).json(new apiresponse(200, {}, "Password reset successful"));
});

const getCurrentHost = asynchandler(async (req, res) => {
  // The host data (without password) is already attached to req.user by the middleware
  return res.status(200).json(new apiresponse(200, req.user, "Current Host fetched successfully"));
});

const verifyHostAadhar = asynchandler(async (req, res) => {
  if (!req.file) throw new apierror(400, "Aadhar PDF file is required");

  const user = await Host.findById(req.user._id);
  if (!user) throw new apierror(404, "User not found");
  const aadharBlob = new Blob([req.file.buffer], { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('file', aadharBlob, 'aadhar.pdf');

  const { data } = await axios.post(
    "https://arjun9036-ridenow.hf.space/validate-aadhaar",
    formData, 
    {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      responseType: "text",
    }
  );

  // ✅ data is a plain string, so use it directly
  const validation = typeof data === "string" ? data : JSON.stringify(data);
  

  // ✅ If valid
  if (validation.includes("✅ Aadhaar number") && validation.includes("valid and found")) {
   
    const uploadResult = await uploadOnCloudinary(req.file.buffer, "pdf");

    user.verifiedDoc.docType = "Aadhar";
    user.verifiedDoc.docUrl = uploadResult.secure_url;
    user.verifiedDoc.status = "approved";
      user.isDocVerified = true;
  

    await user.save();

    return res
      .status(200)
      .json(
        new apiresponse(
          200,
          {
            docType: "Aadhar",
            docUrl: uploadResult.secure_url,
            validation,
          },
          "✅ Aadhar verified and uploaded successfully"
        )
      );
  } else {
    return res
      .status(200)
      .json(new apiresponse(200, { validation }, "⚠️ Aadhar not found in database"));
  }
});


const getHostDocuments = async (req, res) => {
  try {
    const hostId = req.user?._id;

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // ✅ Fetch only verifiedDoc field
    const host = await Host.findById(hostId).select("verifiedDoc");

    if (!host) {
      return res.status(404).json({
        success: false,
        message: "Host not found",
      });
    }

    const { verifiedDoc } = host;

    // ✅ Handle case when no document yet
    if (!verifiedDoc || !verifiedDoc.docUrl) {
      return res.status(200).json({
        success: true,
        document: {
          aadhar: null,
          aadharStatus: "pending",
        },
      });
    }

    // ✅ Return Aadhaar info directly
    return res.status(200).json({
      success: true,
      document: {
        aadhar: verifiedDoc.docUrl,
        aadharStatus: verifiedDoc.status || "pending",
      },
    });
  } catch (error) {
    console.error("❌ Error fetching host documents:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching host documents",
    });
  }
};

const HostUpiid=async(req,res)=>{
    const {upiid}=req.body;
    if (!upiid) throw new apierror(400, "Upi-id is required");
    const host = await Host.findById(req.user._id);
    if (!host) throw new apierror(404, "Host not found");
    host.upiid=upiid;
    await host.save();
    return res.status(200).json(
      new apiresponse(
        200,
        { upiid:host.upiid },
        "Upi-id store"
      )
    );
}
const getHostVehicles = asynchandler(async (req, res) => {
  // ✅ Step 1: Get hostId from JWT middleware
  const hostId = req.user._id;

  // ✅ Step 2: Find host and populate their vehicles
  const host = await Host.findById(hostId).populate({
    path: "vehicles",
    select: "scootyModel location photos isVerified isAvailable availableFrom availableTo createdAt", // choose only relevant fields
  });

  if (!host) {
    throw new apierror(404, "Host not found");
  }

  // ✅ Step 3: If no vehicles
  if (!host.vehicles || host.vehicles.length === 0) {
    return res
      .status(200)
      .json(new apiresponse(200, [], "No vehicles hosted yet."));
  }

  // ✅ Step 4: Return hosted vehicles
  return res.status(200).json(
    new apiresponse(
      200,
      host.vehicles,
      "Hosted vehicles fetched successfully."
    )
  );
});
export {
  loginHost, googleLoginHost, refreshHostAccessToken, logoutHost,
  forgotHostPassword, resetHostPassword, changeHostPassword,
  registerHost, verifyHostOtp, getCurrentHost,verifyHostAadhar,getHostDocuments,HostUpiid,getHostVehicles
};

