require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("./passport");
const parentRoutes = require("./routes/parent");
const storyRoutes = require("./routes/story");
const cors = require("cors");

const app = express();

// Enable CORS for frontend origin
app.use(
  cors({
    origin: "https://baby-story-ai.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err.message));

app.use("/api/parent", parentRoutes);
app.use("/api/story", storyRoutes);
const path = require("path");
app.use("/tts", express.static(path.join(__dirname, "public/tts")));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
