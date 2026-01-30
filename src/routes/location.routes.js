import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/reverse", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ message: "Lat & Lng required" });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          "User-Agent": "RideNow/1.0 (contact@ridenow.app)", // REQUIRED
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Reverse geocoding failed" });
  }
});

export default router;