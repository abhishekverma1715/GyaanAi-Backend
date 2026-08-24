const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    console.log(`✅ MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.error('⚠️  MongoDB connection failed:', err.message);
    console.log('⚠️  MongoDB offline → running in-memory mode');
  }
};

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isConnected };
