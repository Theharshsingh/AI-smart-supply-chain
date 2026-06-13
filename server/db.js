const mongoose = require('mongoose');

// Suppress MongoDB driver's NODE_TLS_REJECT_UNAUTHORIZED warning — Atlas uses valid certs
const _emitWarning = process.emitWarning.bind(process);
process.emitWarning = (msg, ...args) => {
  if (typeof msg === 'string' && msg.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  _emitWarning(msg, ...args);
};

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true,
      });
      console.log('[DB] MongoDB connected via', uri.substring(0, 30) + '...');
      return;
    } catch (err) {
      console.warn('[DB] Atlas connection failed, falling back to in-memory MongoDB:', err.message);
    }
  }

  // Fallback: in-memory MongoDB server
  console.log('[DB] Starting in-memory MongoDB...');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'supplychain',
      storageEngine: 'wiredTiger',
    },
  });
  const memUri = mongod.getUri();
  await mongoose.connect(memUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
  console.log('[DB] In-memory MongoDB connected at', memUri);

  // Keep reference for cleanup on exit
  process.on('SIGINT', async () => {
    await mongod.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await mongod.stop();
    process.exit(0);
  });
}

module.exports = { connectDB };