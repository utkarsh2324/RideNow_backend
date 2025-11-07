// src/models/host.model.js
import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const hostSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    upiid:{
      type:String,
      
      unique:true
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
    },
    dob: { 
      type: Date ,
      default:""
    },
    profile: {
      photo: {
        type: String,
        default: "",
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isDocVerified: {
      type: Boolean,
      default: false,
    },
    verifiedDoc: {
      docType: {
        type: String,
        enum: ["Aadhar"],
        default: null,
      },
      docUrl: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
    },
    // Reference to the vehicles owned by this host
    vehicles: [{
      type: Schema.Types.ObjectId,
      ref: "Vehicle"
    }],
    googleId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    refreshToken: {
      type: String,
      default: null,
    },
    // You can copy the OTP system from the user schema as well
    otp: String,
    otpExpiry: Date,
    otpPurpose: {
      type: String,
      enum: ["register", "forgot"],
    },
    canResetPassword: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔑 Pre-save hook for password hashing
hostSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.authProvider === "local") {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// ✅ Check password
hostSchema.methods.isPasswordCorrect = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 🎟️ Generate Access Token
hostSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

// 🔄 Generate Refresh Token
hostSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

export const Host = mongoose.model("Host", hostSchema);