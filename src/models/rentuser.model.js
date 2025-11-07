import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default:""
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique:true,
      sparse: true,
    // allows null but still enforces uniqueness if filled
     
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
    // ✅ Verification status (for profile badge)
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
    // ✅ Document details (DL, Aadhar, RC, Insurance)
    verifiedDoc: [
      {
        docType: {
          type: String,
          enum: ["DL", "Aadhar"],
          required: true,
        },
        docUrl: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
      },
    ],
    isBookedVehicle: {
      type:Boolean,
      default:false
    },
    // OAuth fields
    googleId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    // Tokens
    refreshToken: {
      type: String,
      default: null,
    },
    // OTP system
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
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.authProvider === "local") {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// ✅ Check password
userSchema.methods.isPasswordCorrect = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 🎟️ Generate Access Token
userSchema.methods.generateAccessToken = function () {
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
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

export const User = mongoose.model("User", userSchema);