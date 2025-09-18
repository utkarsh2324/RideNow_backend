import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// --- FIX: Configure environment variables ---
// This MUST be at the top to make process.env available to the rest of the app
dotenv.config({
  path: './.env' 
});
// ------------------------------------------

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // Your frontend URL
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("✅ Server is running fine!");
});

// Middlewares
app.use(express.json({ limit: "500mb" })); // A smaller limit is safer
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser());

// Routes
import userRouter from "./routes/rentuser.routes.js";
import profileRouter from "./routes/rentuserprofiler.routes.js";
app.use("/api/v1/users", userRouter);
app.use("/api/v1/users/profile/", profileRouter);

export default app;
