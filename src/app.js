import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});

const app = express();

const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://ride-now-frontend.vercel.app",
  "https://www.ridenow.website", // Your production frontend
];

// ✅ Use dynamic check (for safety and flexibility)
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ Allow sending/receiving cookies
  })
);

// ✅ Handle preflight requests explicitly
app.options(/.*/, cors());


app.get("/", (req, res) => {
  res.send("✅ Server is running fine!");
});

// 2. Middlewares updated with safer limits
app.use(express.json({ limit: "500mb" })); 
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// --- 3. Route Imports (Web AND App) ---

// --- Web Routes (Existing) ---
import userRouter from "./routes/rentuser.routes.js";
import profileRouter from "./routes/rentuserprofiler.routes.js";
import hostRouter from "./routes/host.routes.js";
import hostProfileRouter from "./routes/hostprofile.route.js";
import vehicleRouter from "./routes/vehicle.routes.js";
import hostNotificationRouter from "./routes/notification.routes.js";

// --- App Routes (NEW) ---
import userAppRouter from "./routes/rentuser.app.routes.js";
import profileAppRouter from "./routes/rentuserprofiler.app.routes.js";
import vehicleAppRouter from "./routes/vehicle.app.routes.js";

// --- 4. Route Declarations (Web AND App) ---

// --- Web Route Declarations (Existing - Unchanged) ---
app.use("/api/v1/users", userRouter);
app.use("/api/v1/users/profile", profileRouter);
app.use("/api/v1/hosts", hostRouter);
app.use("/api/v1/hosts/profile", hostProfileRouter);
app.use("/api/v1/vehicles", vehicleRouter);
app.use("/api/v1/hosts/notifications", hostNotificationRouter);

// --- App Route Declarations (NEW) ---
// We mount the app routes on a separate /app prefix
app.use("/api/v1/app/users", userAppRouter);
app.use("/api/v1/app/profile", profileAppRouter);
app.use("/api/v1/app/vehicles", vehicleAppRouter);


export default app;
