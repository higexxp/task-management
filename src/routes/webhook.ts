import { Router, Request, Response } from 'express';
import { WebhookService } from '../services/webhook.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const webhookService = new WebhookService();

/**
 * GitHub webhook endpoint
 * Receives and processes GitHub webhook events
 */
router.post('/github', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventType = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;
  
  logger.info('Received GitHub webhook', {
    eventType,
    deliveryId,
    hasSignature: !!signature,
  });

  // Verify webhook signature
  const payload = JSON.stringify(req.body);
  if (!webhookService.verifySignature(payload, signature)) {
    logger.warn('Invalid webhook signature', { deliveryId, eventType });
    res.status(401).json({
      error: 'Invalid signature',
      message: 'Webhook signature verification failed',
    });
    return;
  }

  try {
    // Process the webhook event
    await webhookService.processWebhookEvent(req.body, eventType);
    
    logger.info('Successfully processed webhook', {
      eventType,
      deliveryId,
      action: req.body.action,
      repository: req.body.repository?.full_name,
    });

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      deliveryId,
      eventType,
    });

  } catch (error) {
    logger.error('Failed to process webhook', {
      eventType,
      deliveryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      deliveryId,
    });
  }
}));

/**
 * Webhook health check endpoint
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const stats = await webhookService.getWebhookStats();
  
  res.json({
    status: 'healthy',
    service: 'webhook',
    timestamp: new Date().toISOString(),
    stats,
  });
}));

/**
 * Test webhook endpoint (development only)
 */
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { eventType, mockData } = req.body;
  
  if (!eventType) {
    res.status(400).json({
      error: 'Missing eventType',
      message: 'eventType is required for testing',
    });
    return;
  }

  try {
    await webhookService.testWebhook(eventType, mockData || {});
    
    res.json({
      success: true,
      message: 'Test webhook processed successfully',
      eventType,
    });

  } catch (error) {
    logger.error('Failed to process test webhook', {
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Test webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * Get webhook statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await webhookService.getWebhookStats();
  
  res.json({
    success: true,
    data: stats,
  });
}));

export default router;