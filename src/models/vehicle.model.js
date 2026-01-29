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
      address: String,
      landmark: String,
      city: {
        type: String,
        index: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
        },
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
vehicleSchema.index({ "pickupLocation.coordinates": "2dsphere" });
export const Vehicle = mongoose.model("Vehicle", vehicleSchema);