import mongoose from 'mongoose';

let isConnected = false;
let mongoMemoryServerInstance = null;

/**
 * Scrubs credentials (username:password) from connection URIs for safe logging
 */
export const sanitizeMongoUri = (rawUri = '') => {
  if (!rawUri) return '';
  return rawUri.replace(/\/\/(.*?)@/, '//***:***@');
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shakti_exam_db';
  const isProd = process.env.NODE_ENV === 'production';
  const isAtlasOrRemote = uri.includes('mongodb+srv://') || uri.includes('mongodb.net') || (process.env.MONGODB_URI && !uri.includes('127.0.0.1') && !uri.includes('localhost'));

  mongoose.set('strictQuery', false);

  const connectOptions = {
    serverSelectionTimeoutMS: isAtlasOrRemote ? 10000 : 3000,
  };

  // Ensure default dbName if not present in connection string
  if (!uri.split('?')[0].split('/').slice(3).join('') && !uri.includes('shakti_exam_db')) {
    connectOptions.dbName = 'shakti_exam_db';
  }

  const safeLoggedUri = sanitizeMongoUri(uri);

  try {
    await mongoose.connect(uri, connectOptions);
    isConnected = true;
    console.log(`[Database] Successfully connected to MongoDB at ${safeLoggedUri}`);
  } catch (err) {
    if (isProd || isAtlasOrRemote) {
      console.error(`[CRITICAL DATABASE FAILURE] Failed to connect to MongoDB Atlas / Remote Database (${safeLoggedUri}): ${err.message}`);
      console.error(`[Database Safety Guard] Production/Atlas connection failed. In-Memory fallback IS DISABLED for production/Atlas environments.`);
      isConnected = false;
      if (isProd) {
        process.exit(1);
      }
      throw err;
    } else {
      console.warn(`[Database Warning] Local MongoDB daemon not detected (${err.message}). Booting local in-memory fallback for offline development...`);
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        if (!mongoMemoryServerInstance) {
          mongoMemoryServerInstance = await MongoMemoryServer.create();
        }
        const memUri = mongoMemoryServerInstance.getUri();
        await mongoose.connect(memUri);
        isConnected = true;
        console.log(`[Database] Successfully connected to In-Memory MongoDB Server at ${memUri}`);
      } catch (memErr) {
        console.warn(`[Database Retry] Re-creating MongoMemoryServer instance...`);
        try {
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          mongoMemoryServerInstance = await MongoMemoryServer.create({ instance: { port: 0 } });
          const memUri = mongoMemoryServerInstance.getUri();
          await mongoose.connect(memUri);
          isConnected = true;
          console.log(`[Database] Connected to fresh In-Memory MongoDB Server at ${memUri}`);
        } catch (retryErr) {
          console.error(`[Database Error] ${retryErr.message}`);
          isConnected = false;
        }
      }
    }
  }
};

export const getDBStatus = () => isConnected;
