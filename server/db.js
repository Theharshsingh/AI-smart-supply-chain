const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/supplychain';
  await mongoose.connect(uri);
  console.log('[DB] MongoDB connected');
}

module.exports = { connectDB };
