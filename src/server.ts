import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { redisService } from './services/redis.js';
import { initializeWebSocket } from './services/websocket.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  const redisStats = redisService.getUsageStats();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    redis: {
      enabled: config.redis.enabled,
      mode: redisStats.mode,
      stats: redisStats,
    },
  });
});

// Import routes
import metadataRoutes from './routes/metadata.js';
import dependencyRoutes from './routes/dependencies.js';
import issueRoutes from './routes/issues.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import workloadRoutes from './routes/workload.js';
import timeTrackingRoutes from './routes/timeTracking.js';
import syncRoutes from './routes/sync.js';

// API routes
app.use('/api/metadata', metadataRoutes);
app.use('/api/dependencies', dependencyRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/workload', workloadRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/sync', syncRoutes);

// Development endpoint to trigger usage check
app.post('/api/dev/trigger-usage-check', (req, res) => {
  if (config.env !== 'development') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Force usage check
  redisService.triggerUsageCheck();
  const stats = redisService.getUsageStats();

  res.json({
    success: true,
    message: 'Usage check triggered - check server logs for recommendations',
    stats,
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'GitHub Task Extension API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metadata: '/api/metadata',
      dependencies: '/api/dependencies',
      issues: '/api/issues',
      auth: '/api/auth',
      webhooks: '/api/webhooks',
      workload: '/api/workload',
      timeTracking: '/api/time-tracking',
      sync: '/api/sync',
    },
  });
});

// Serve static files from the React app in production
if (config.env === 'production') {
  // Note: In production, you would typically use a reverse proxy (nginx)
  // to serve static files. For now, we'll just show a message.
  app.get('/', (req, res) => {
    res.json({
      message: 'GitHub Task Extension API - Production Mode',
      note: 'Frontend should be served by a reverse proxy (nginx) in production',
      api: 'API is running on this port',
    });
  });
} else {
  // Development mode - API only
  app.get('/', (req, res) => {
    res.json({
      message: 'GitHub Task Extension API - Development Mode',
      frontend: 'Run `npm run dev:frontend` to start the frontend development server',
      api: 'API is running on this port',
    });
  });
}

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await redisService.disconnect();
    logger.info('Redis connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Try to connect to Redis (non-blocking)
    try {
      await redisService.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis connection failed, continuing with in-memory fallback', { error });
    }

    // Initialize WebSocket server
    initializeWebSocket(httpServer);
    logger.info('WebSocket server initialized');

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
      logger.info('API endpoints available:');
      logger.info('  GET  /health - Health check');
      logger.info('  GET  /api - API information');
      logger.info('  GET  /api/metadata/options - Metadata options');
      logger.info('  GET  /api/metadata/labels - Required labels');
      logger.info('  POST /api/metadata/extract - Extract metadata from labels');
      logger.info('  POST /api/metadata/convert - Convert metadata to labels');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();