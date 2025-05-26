require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const storyRoutes = require('./routes/story');
const parentRoutes = require('./routes/parent');
const { connectDB } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/story', storyRoutes);
app.use('/api/parent', parentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));