import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    host: {
      type: Schema.Types.ObjectId,
      ref: "Host",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "DOC_VERIFIED",
        "DOC_REJECTED",
        "DOC_PENDING",
        "VEHICLE_VERIFIED",
        "VEHICLE_REJECTED",
        "BOOKING_CONFIRMED",
        "BOOKING_CANCELLED",
        "BOOKING_COMPLETED",
        "VEHICLE_AVAILABILITY_CHANGED",
        "PROFILE_INCOMPLETE",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedVehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    relatedBooking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);