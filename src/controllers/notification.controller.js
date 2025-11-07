import { Notification } from "../models/notification.model.js";
import { Host } from "../models/host.model.js";
import { Vehicle } from "../models/vehicle.model.js";

/**
 * ✅ Get all notifications for the logged-in host
 * Includes:
 *  - Profile completion status
 *  - Vehicle verification status
 *  - Booking updates
 *  - Real stored notifications
 */
export const getHostNotifications = async (req, res) => {
  try {
    const hostId = req.user._id;

    // ✅ Populate vehicles with booking -> user details
    const host = await Host.findById(hostId)
      .populate({
        path: "vehicles",
        populate: {
          path: "bookings.userId", // populate user for each booking
          select: "name email phone", // only needed fields
        },
      })
      .lean();

    if (!host)
      return res.status(404).json({ success: false, message: "Host not found" });

    const computed = [];

    // 1️⃣ PROFILE COMPLETION CHECK — Show missing fields only
    const missingFields = [];
    if (!host.name || host.name.trim() === "") missingFields.push("Name");
    if (!host.phone || host.phone.trim() === "") missingFields.push("Phone number");
    if (!host.dob || host.dob === "") missingFields.push("Date of birth");
    if (!host.profile?.photo || host.profile.photo.trim() === "")
      missingFields.push("Profile photo");
    if (!host.isDocVerified) missingFields.push("Document verification");

    if (missingFields.length > 0) {
      computed.push({
        _id: "computed-profile-incomplete",
        type: "PROFILE_INCOMPLETE",
        title: "Complete Your Profile ⚠️",
        message: `Your profile is missing: ${missingFields.join(", ")}.`,
        isRead: false,
        createdAt: new Date(),
      });
    }

    // 2️⃣ VEHICLE CHECK
    if (!host.vehicles || host.vehicles.length === 0) {
      computed.push({
        _id: "computed-no-vehicle",
        type: "NO_VEHICLE",
        title: "Add Your First Vehicle 🛵",
        message: "You haven’t listed any vehicle yet. Add one to start earning!",
        isRead: false,
        createdAt: new Date(),
      });
    } else {
      for (const vehicle of host.vehicles) {
        // Pending verification notifications
        if (!vehicle.isVerified) {
          computed.push({
            _id: `computed-vehicle-${vehicle._id}`,
            type: "VEHICLE_PENDING",
            title: "Vehicle Verification Pending",
            message: `Your vehicle "${vehicle.scootyModel}" is awaiting admin verification.`,
            relatedVehicle: vehicle._id,
            isRead: false,
            createdAt: new Date(),
          });
        }

        // 3️⃣ BOOKINGS WITH USER DETAILS
        if (vehicle.bookings && vehicle.bookings.length > 0) {
          vehicle.bookings.forEach((booking) => {
            const user = booking.userId || {}; // populated user data

            computed.push({
              _id: `booking-${vehicle._id}-${booking._id}`,
              type: `BOOKING_${booking.bookingStatus.toUpperCase()}`,
              title: `Booking ${booking.bookingStatus}`,
              message: `Your vehicle "${vehicle.scootyModel}" has been booked by ${user.name || "Unknown User"} from ${new Date(
                booking.startDate
              ).toLocaleDateString()} to ${new Date(
                booking.endDate
              ).toLocaleDateString()} (Status: ${booking.bookingStatus}).`,
              relatedVehicle: vehicle._id,
              relatedBooking: booking._id,
              renter: {
                name: user.name || "N/A",
                email: user.email || "N/A",
                phone: user.phone || "N/A",
              },
              isRead: booking.bookingStatus === "completed",
              createdAt: booking.createdAt || new Date(),
            });
          });
        }
      }
    }

    // 4️⃣ FETCH SAVED NOTIFICATIONS
    const savedNotifications = await Notification.find({ host: hostId })
      .sort({ createdAt: -1 })
      .lean();

    // 🧹 AUTO-CLEANUP
    if (missingFields.length === 0) {
      await Notification.deleteMany({ host: hostId, type: "PROFILE_INCOMPLETE" });
    }
    if (host.vehicles && host.vehicles.length > 0) {
      await Notification.deleteMany({ host: hostId, type: "NO_VEHICLE" });
    }

    // ✅ Combine and sort all notifications
    const allNotifications = [...computed, ...savedNotifications].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      count: allNotifications.length,
      notifications: allNotifications,
    });
  } catch (error) {
    console.error("❌ Error in getHostNotifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching host notifications",
    });
  }
};

/**
 * ✅ Mark a notification as read
 */
export const markHostNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, host: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found" });

    res.json({ success: true, notification });
  } catch (error) {
 
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};