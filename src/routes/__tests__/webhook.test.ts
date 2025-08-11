import request from 'supertest';
import express from 'express';

// Mock the webhook service BEFORE importing the routes
const mockWebhookService = {
  verifySignature: jest.fn(),
  processWebhookEvent: jest.fn(),
  getWebhookStats: jest.fn(),
  testWebhook: jest.fn(),
};

jest.mock('../../services/webhook', () => ({
  WebhookService: jest.fn().mockImplementation(() => mockWebhookService),
}));

// Now import the routes after mocking
import webhookRoutes from '../webhook';

describe('Webhook Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/webhooks', webhookRoutes);
  });

  describe('POST /webhooks/github', () => {
    const validPayload = {
      action: 'opened',
      issue: {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        labels: [],
      },
      repository: {
        full_name: 'test/repo',
        name: 'repo',
        owner: { login: 'test' },
      },
      sender: { login: 'test-user' },
    };

    const validHeaders = {
      'x-github-event': 'issues',
      'x-github-delivery': 'test-delivery-id',
      'x-hub-signature-256': 'sha256=valid-signature',
    };

    it('should process valid webhook', async () => {
      mockWebhookService.verifySignature.mockReturnValue(true);
      mockWebhookService.processWebhookEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/github')
        .set(validHeaders)
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook processed successfully',
        deliveryId: 'test-delivery-id',
        eventType: 'issues',
      });

      expect(mockWebhookService.verifySignature).toHaveBeenCalledWith(
        JSON.stringify(validPayload),
        'sha256=valid-signature'
      );
      expect(mockWebhookService.processWebhookEvent).toHaveBeenCalledWith(
        validPayload,
        'issues'
      );
    });

    it('should reject webhook with invalid signature', async () => {
      mockWebhookService.verifySignature.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/github')
        .set(validHeaders)
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed',
      });

      expect(mockWebhookService.verifySignature).toHaveBeenCalled();
      expect(mockWebhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('should handle webhook processing errors', async () => {
      mockWebhookService.verifySignature.mockReturnValue(true);
      mockWebhookService.processWebhookEvent.mockRejectedValue(
        new Error('Processing failed')
      );

      const response = await request(app)
        .post('/webhooks/github')
        .set(validHeaders)
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Webhook processing failed',
        message: 'Processing failed',
        deliveryId: 'test-delivery-id',
      });
    });

    it('should handle missing headers gracefully', async () => {
      mockWebhookService.verifySignature.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/github')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockWebhookService.verifySignature).toHaveBeenCalledWith(
        JSON.stringify(validPayload),
        undefined
      );
    });
  });

  describe('GET /webhooks/health', () => {
    it('should return health status', async () => {
      const mockStats = {
        totalEvents: 10,
        eventsByType: { issues: 5, ping: 5 },
        recentEvents: [],
      };

      mockWebhookService.getWebhookStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/webhooks/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'webhook',
        stats: mockStats,
      });
    });
  });

  describe('POST /webhooks/test', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should process test webhook in development', async () => {
      mockWebhookService.testWebhook.mockResolvedValue(undefined);

      const testData = {
        eventType: 'issues',
        mockData: { action: 'opened' },
      };

      const response = await request(app)
        .post('/webhooks/test')
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Test webhook processed successfully',
        eventType: 'issues',
      });

      expect(mockWebhookService.testWebhook).toHaveBeenCalledWith(
        'issues',
        { action: 'opened' }
      );
    });

    it('should reject test webhook in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/webhooks/test')
        .send({ eventType: 'issues' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should require eventType', async () => {
      const response = await request(app)
        .post('/webhooks/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing eventType',
        message: 'eventType is required for testing',
      });
    });

    it('should handle test webhook errors', async () => {
      mockWebhookService.testWebhook.mockRejectedValue(
        new Error('Test failed')
      );

      const response = await request(app)
        .post('/webhooks/test')
        .send({ eventType: 'issues' });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Test webhook processing failed',
        message: 'Test failed',
      });
    });
  });

  describe('GET /webhooks/stats', () => {
    it('should return webhook statistics', async () => {
      const mockStats = {
        totalEvents: 25,
        eventsByType: {
          issues: 15,
          ping: 5,
          label: 3,
          issue_comment: 2,
        },
        recentEvents: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            eventType: 'issues',
            action: 'opened',
            repository: 'test/repo',
          },
        ],
      };

      mockWebhookService.getWebhookStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/webhooks/stats');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockStats,
      });
    });
  });
});