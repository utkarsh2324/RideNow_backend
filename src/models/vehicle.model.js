import mongoose, { Schema } from "mongoose";

const vehicleSchema = new Schema(
  {
    host: {
      type: Schema.Types.ObjectId,
      ref: "Host",
      required: true,
      index: true,
    },

    scootyModel: {
      type: String,
      required: true,
      trim: true,
    },

    documents: {
      rc: {
        type: String,
        required: true,
      },
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    pickupLocation: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      landmark: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    photos: [
      {
        type: String,
        required: true,
      },
    ],

    isAvailable: {
      type: Boolean,
      default: true,
    },

    pricing: {
      weekdayPrice: {
        type: Number,
        required: true,
        min: 1,
      },
      weekendPrice: {
        type: Number,
        required: true,
        min: 1,
      },
    },

    bookings: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        returnedAt: { type: Date },
        totalPrice: { type: Number, required: true },
        bookingStatus: {
          type: String,
          enum: ["pending", "confirmed", "completed", "canceled"],
          default: "pending",
        },
      },
    ],

    NumberOfBooking: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);