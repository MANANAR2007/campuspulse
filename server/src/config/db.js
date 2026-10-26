import mongoose from 'mongoose';
import { config } from './index.js';

let isConnected = false;

/**
 * Returns current database connectivity status string for health checks
 */
export const getDbStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Connect to MongoDB Atlas with robust error diagnostics and credential sanitization
 */
export const connectDB = async () => {
  const uri = config.mongodbUri;

  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    throw new Error(
      'Missing MONGODB_URI environment variable. Please configure your MongoDB Atlas connection string in your environment (e.g. Render Dashboard or server/.env).'
    );
  }

  // Setup connection event listeners
  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('✅ MongoDB connected successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error occurred:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️  MongoDB disconnected. Waiting to reconnect...');
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    return conn;
  } catch (err) {
    // Sanitize any URI credentials from error messages to protect secrets
    let sanitizedError = err.message
      ? err.message.replace(/mongodb(\+srv)?:\/\/[^@]+@/, 'mongodb+srv://[credentials-hidden]@')
      : 'Failed to establish connection to MongoDB cluster';

    // Provide actionable diagnostic advice for common Atlas connection hurdles
    if (
      sanitizedError.includes('Could not connect to any servers') ||
      sanitizedError.includes('SSL alert') ||
      sanitizedError.includes('ServerSelectionError')
    ) {
      sanitizedError +=
        ' | DIAGNOSTIC: Atlas cluster rejected the connection. For Render or dynamic IPs, ensure 0.0.0.0/0 is added to MongoDB Atlas -> Network Access -> IP Access List, and verify that the cluster is not paused.';
    }

    throw new Error(sanitizedError);
  }
};
