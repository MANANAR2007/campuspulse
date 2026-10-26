import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import { initSocket } from './utils/socket.js';

const { port, host, nodeEnv } = config;

/**
 * Start the backend server after successfully connecting to MongoDB Atlas
 */
const startServer = async () => {
  try {
    // 1. Establish database connection before accepting traffic
    console.log('🔄 Connecting to MongoDB Atlas...');
    await connectDB();

    // 2. Create HTTP server and initialize authenticated Socket.IO
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    // 3. Start listening on configured host and port
    const server = httpServer.listen(port, host, () => {
      console.log(`🚀 CampusPulse API server running at http://${host}:${port} [${nodeEnv}]`);
      console.log(`🔌 Socket.IO enabled on path /socket.io`);
      console.log(`🩺 Health check: http://${host}:${port}/api/health`);
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err.message);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down CampusPulse API server...');
      server.close(() => {
        console.log('HTTP and Socket.IO server closed.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Fatal Database Connection Error:', error.message);
    console.error('💡 Troubleshooting Steps:');
    console.error('   1. Verify MONGODB_URI is set in the runtime environment (Render dashboard in production, server/.env locally).');
    console.error('   2. Verify that 0.0.0.0/0 (or your server IP) is allowed in MongoDB Atlas -> Network Access.');
    console.error('   3. Ensure your MongoDB Atlas cluster is running and not paused.');
    process.exit(1);
  }
};

startServer();
