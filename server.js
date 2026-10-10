const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const bookingSchema = new mongoose.Schema(
  {
    hostelId: {
      type: String,
      required: true,
    },
    hostelName: {
      type: String,
      required: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      match: /^[6-9]\d{9}$/,
    },
    checkIn: {
      type: String,
      required: true,
    },
    roomPreference: {
      type: String,
      enum: ["Shared Room", "Two Sharing", "Single Room"],
      default: "Shared Room",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

app.get("/", (req, res) => {
  res.send("Smart Hostel Management Backend is Running!");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Smart Hostel API is working",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Get all bookings from MongoDB
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load booking requests.",
    });
  }
});

// Save a new booking in MongoDB
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      hostelId,
      hostelName,
      studentName,
      phone,
      checkIn,
      roomPreference,
    } = req.body;

    if (
      hostelId === undefined ||
      hostelId === null ||
      !String(hostelName || "").trim() ||
      !String(studentName || "").trim() ||
      !/^[6-9]\d{9}$/.test(String(phone || "")) ||
      !checkIn ||
      !["Shared Room", "Two Sharing", "Single Room"].includes(
        roomPreference
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid booking details.",
      });
    }

    // Interpret the date as a calendar date, not a UTC timestamp.
    const dateParts = String(checkIn).split("-").map(Number);
    const requestedDate =
      dateParts.length === 3
        ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
        : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
      !requestedDate ||
      Number.isNaN(requestedDate.getTime()) ||
      requestedDate < today
    ) {
      return res.status(400).json({
        success: false,
        message: "Choose today or a future check-in date.",
      });
    }

    const booking = await Booking.create({
      hostelId: String(hostelId),
      hostelName: String(hostelName).trim(),
      studentName: String(studentName).trim(),
      phone: String(phone),
      checkIn: String(checkIn),
      roomPreference,
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Booking request saved successfully.",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not save booking. Please try again.",
    });
  }
});

// Approve or reject an existing booking
app.patch("/api/bookings/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking request not found.",
      });
    }

    res.json({
      success: true,
      message: `Booking ${status.toLowerCase()} successfully.`,
      booking,
    });
  } catch (error) {
    console.error("Update booking error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update booking status.",
    });
  }
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from your server .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();