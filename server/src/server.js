import app from './app.js';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';

const { port, host, nodeEnv } = config;

/**
 * Start the backend server after successfully connecting to MongoDB Atlas
 */
const startServer = async () => {
  try {
    // 1. Establish database connection before accepting traffic
    console.log('🔄 Connecting to MongoDB Atlas...');
    await connectDB();

    // 2. Start HTTP server
    const server = app.listen(port, host, () => {
      console.log(`🚀 CampusPulse API server running at http://${host}:${port} [${nodeEnv}]`);
      console.log(`🩺 Health check: http://${host}:${port}/api/health`);
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err.message);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down CampusPulse API server...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Fatal Database Connection Error:', error.message);
    console.error('💡 Please verify your MONGODB_URI in server/.env.');
    process.exit(1);
  }
};

startServer();
