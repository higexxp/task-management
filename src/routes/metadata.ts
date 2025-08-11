import { Router, Request, Response } from 'express';
import { MetadataService } from '../services/metadata.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';

const router = Router();
const metadataService = new MetadataService();

// Get all available metadata options
router.get('/options', async (req: Request, res: Response) => {
  try {
    // Check cache first
    const cacheKey = redisService.getCacheKey('metadata', 'options');
    let options = await redisService.get<any>(cacheKey);
    
    if (!options) {
      // Generate options and cache for 1 hour
      options = {
        priority: ['low', 'medium', 'high', 'critical'],
        category: ['frontend', 'backend', 'design', 'testing', 'docs'],
        estimatedSize: ['xs', 'small', 'medium', 'large', 'xl'],
        status: ['todo', 'in-progress', 'review', 'done'],
        timeSpent: ['none', '0-2h', '2-4h', '4-8h', '8h+'],
      };
      await redisService.set(cacheKey, options, 3600);
    }

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to get metadata options', { 
      error: errorMessage,
      stack: errorStack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Get all required labels for a repository
router.get('/labels', async (req: Request, res: Response) => {
  try {
    // Check cache first
    const cacheKey = redisService.getCacheKey('labels', 'all');
    let labels = await redisService.get<any[]>(cacheKey);
    
    if (!labels) {
      // Generate labels and cache for 1 hour
      labels = metadataService.getAllRequiredLabels();
      await redisService.set(cacheKey, labels, 3600);
    }
    
    res.json({
      success: true,
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to get required labels', { 
      error: errorMessage,
      stack: errorStack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Test metadata extraction from labels
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { labels } = req.body;
    
    if (!Array.isArray(labels)) {
      res.status(400).json({
        success: false,
        error: 'Labels must be an array',
      });
      return;
    }

    // Check cache for this specific label combination
    const cacheKey = redisService.getCacheKey('extract', JSON.stringify(labels.sort()));
    let result = await redisService.get<any>(cacheKey);
    
    if (!result) {
      // Extract metadata and cache for 30 minutes
      const metadata = metadataService.extractMetadataFromLabels(labels);
      result = {
        labels,
        extractedMetadata: metadata,
      };
      await redisService.set(cacheKey, result, 1800);
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to extract metadata', { 
      error: errorMessage,
      stack: errorStack,
      requestBody: req.body 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Test metadata to labels conversion
router.post('/convert', (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Metadata must be an object',
      });
      return;
    }

    // Validate metadata
    const validation = metadataService.validateMetadata(metadata);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid metadata',
        details: validation.errors,
      });
      return;
    }

    const labels = metadataService.convertMetadataToLabels(metadata);
    
    res.json({
      success: true,
      data: {
        metadata,
        generatedLabels: labels,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to convert metadata', { 
      error: errorMessage,
      stack: errorStack,
      requestBody: req.body 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

export default router;