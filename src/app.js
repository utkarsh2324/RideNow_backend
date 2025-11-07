import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config({
  path: './.env' 
});

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("✅ Server is running fine!");
});

// Middlewares
app.use(express.json({ limit: "500mb" })); 
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// --- Routes ---
import userRouter from "./routes/rentuser.routes.js";
import profileRouter from "./routes/rentuserprofiler.routes.js";
// ADDED: Import host and vehicle routers
import hostRouter from "./routes/host.routes.js";
import hostProfileRouter from "./routes/hostprofile.route.js";
import vehicleRouter from "./routes/vehicle.routes.js";
import hostNotificationRouter from "./routes/notification.routes.js";

// --- Route Declarations ---
app.use("/api/v1/users", userRouter);
app.use("/api/v1/users/profile", profileRouter);

// ADDED: Use the new routers
app.use("/api/v1/hosts", hostRouter);
app.use("/api/v1/hosts/profile", hostProfileRouter);
app.use("/api/v1/vehicles", vehicleRouter);
app.use("/api/v1/hosts/notifications", hostNotificationRouter);

export default app;
