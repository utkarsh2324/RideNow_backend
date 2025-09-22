import { Host } from "../models/host.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { asynchandler } from "../utils/asynchandler.js";
import { apierror } from "../utils/apierror.js";
import { apiresponse } from "../utils/apiresponse.js";
import { generateOtp } from "../utils/generateotp.js";
import { sendEmail } from "../utils/sendemail.js";
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
      .cookie("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: 'strict' })
      .cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' })
      .json(new apiresponse(200, { host, accessToken }, "Host login successful"));
});

const googleLoginHost = asynchandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new apierror(400, "Google token is required");
  const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  const { email, name, sub: googleId } = ticket.getPayload();
  let host = await Host.findOne({ email });
  if (!host) {
    host = await Host.create({ email, name, googleId, authProvider: "google", isEmailVerified: true });
  }
  const accessToken = host.generateAccessToken();
  const refreshToken = host.generateRefreshToken();
  host.refreshToken = refreshToken;
  await host.save({ validateBeforeSave: false });
  return res.status(200)
    .cookie("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: 'strict' })
    .cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' })
    .json(new apiresponse(200,{ host, accessToken },"Host logged in successfully"));
});

const logoutHost = asynchandler(async (req, res) => {
  await Host.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: null }
  });

  return res
    .status(200)
    .clearCookie("accessToken", { httpOnly: true, secure: true })
    .clearCookie("refreshToken", { httpOnly: true, secure: true })
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

export {
  loginHost, googleLoginHost, refreshHostAccessToken, logoutHost,
  forgotHostPassword, resetHostPassword, changeHostPassword,
  registerHost, verifyHostOtp, getCurrentHost,
};

