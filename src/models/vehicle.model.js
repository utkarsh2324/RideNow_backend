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
      description: "e.g., 'Honda Activa', 'TVS Jupiter', 'Ola S1 Pro'",
    },
    documents: {
      rc: {
        type: String, // URL from Cloudinary
        required: true,
      }
    },
    isVerified: {
      type: Boolean,
      default: false,
      description: "Set to true by an admin after verifying documents",
    },
    location: {
      type: String,
      required: true,
      trim: true,
      description: "e.g., 'Koramangala, Bangalore'",
    },
    city: {
      type: String,
      required: true,
      trim: true,
      description: "e.g., 'Koramangala, Bangalore'",
    },
    photos: [
      {
        type: String, // URLs from Cloudinary
        required: true,
      },
    ],
    // You mentioned price will be handled by another model
    // price: { ... }
    isAvailable: {
      type: Boolean,
      default: true,
      description: "Can be toggled by the host to quickly take it off the listing",
    },
    bookings: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        totalPrice: { type: Number, required: true },
        bookingStatus: { 
            type: String, 
            enum: ['available','pending', 'confirmed', 'Completed','canceled'], 
            default: 'pending'
        }
      },
    ],
    NumberOfBooking:{
      type:Number
    }
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
