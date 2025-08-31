import { Router, Request, Response } from 'express';
import { syncService } from '../services/sync.js';
import { getWebSocketService } from '../services/websocket.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

/**
 * Get sync status for a repository
 */
router.get('/:owner/:repo/status', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    const repository = `${owner}/${repo}`;
    const status = syncService.getSyncStatus(repository);

    return res.json({
        success: true,
        data: status,
    });
}));

/**
 * Get sync status for all repositories
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
    const statuses = syncService.getAllSyncStatuses();

    return res.json({
        success: true,
        data: statuses,
    });
}));

/**
 * Trigger sync for a repository
 */
router.post('/:owner/:repo/sync', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { force = false, skipCache = false, batchSize } = req.body;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    const repository = `${owner}/${repo}`;

    logger.info('Manual sync triggered', {
        repository,
        force,
        skipCache,
        batchSize,
        userAgent: req.get('User-Agent'),
    });

    try {
        const status = await syncService.syncRepository(repository, {
            force,
            skipCache,
            batchSize,
        });

        return res.json({
            success: true,
            data: status,
            message: 'Sync completed successfully',
        });
    } catch (error) {
        logger.error('Manual sync failed', {
            repository,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Sync failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Force sync for a repository (clears cache first)
 */
router.post('/:owner/:repo/force-sync', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    const repository = `${owner}/${repo}`;

    logger.info('Force sync triggered', {
        repository,
        userAgent: req.get('User-Agent'),
    });

    try {
        const status = await syncService.forceSyncRepository(repository);

        return res.json({
            success: true,
            data: status,
            message: 'Force sync completed successfully',
        });
    } catch (error) {
        logger.error('Force sync failed', {
            repository,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Force sync failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Clear cache for a repository
 */
router.delete('/:owner/:repo/cache', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    const repository = `${owner}/${repo}`;

    logger.info('Cache clear triggered', {
        repository,
        userAgent: req.get('User-Agent'),
    });

    try {
        await syncService.clearRepositoryCache(repository);

        return res.json({
            success: true,
            message: 'Cache cleared successfully',
        });
    } catch (error) {
        logger.error('Cache clear failed', {
            repository,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Cache clear failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get cache statistics
 */
router.get('/cache/stats', asyncHandler(async (req: Request, res: Response) => {
    try {
        const stats = await syncService.getCacheStats();
        const redisStats = redisService.getUsageStats();

        return res.json({
            success: true,
            data: {
                cache: stats,
                redis: redisStats,
            },
        });
    } catch (error) {
        logger.error('Error getting cache stats', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get cache statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get WebSocket connection statistics
 */
router.get('/websocket/stats', asyncHandler(async (req: Request, res: Response) => {
    try {
        const webSocketService = getWebSocketService();
        const stats = webSocketService.getStats();
        const clients = webSocketService.getConnectedClients();

        return res.json({
            success: true,
            data: {
                stats,
                clients: clients.map(client => ({
                    id: client.id,
                    userId: client.userId,
                    repositories: Array.from(client.repositories),
                    connectedAt: client.connectedAt,
                    lastActivity: client.lastActivity,
                })),
            },
        });
    } catch (error) {
        logger.error('Error getting WebSocket stats', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get WebSocket statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Send test message via WebSocket
 */
router.post('/websocket/test', asyncHandler(async (req: Request, res: Response) => {
    const { repository, userId, message } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required',
        });
    }

    try {
        const webSocketService = getWebSocketService();

        const testMessage = {
            type: 'test_message',
            data: {
                message,
                sender: 'api',
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        };

        if (repository) {
            webSocketService.broadcastToRepository(repository, testMessage);
        } else if (userId) {
            webSocketService.sendToUser(userId, testMessage);
        } else {
            webSocketService.broadcast(testMessage);
        }

        return res.json({
            success: true,
            message: 'Test message sent successfully',
            data: {
                target: repository ? `repository:${repository}` : userId ? `user:${userId}` : 'all',
                message: testMessage,
            },
        });
    } catch (error) {
        logger.error('Error sending test message', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to send test message',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get system health status
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    try {
        const redisStats = redisService.getUsageStats();
        const cacheStats = await syncService.getCacheStats();

        let webSocketStats;
        try {
            const webSocketService = getWebSocketService();
            webSocketStats = webSocketService.getStats();
        } catch (error) {
            webSocketStats = {
                connectedClients: 0,
                activeRepositories: 0,
                error: 'WebSocket service not initialized',
            };
        }

        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                redis: {
                    status: redisStats.mode === 'redis' ? 'connected' : 'fallback',
                    mode: redisStats.mode,
                    hitRate: redisStats.hitRate,
                },
                cache: {
                    status: 'operational',
                    totalKeys: cacheStats.totalKeys,
                    memoryUsage: cacheStats.memoryUsage,
                    repositories: cacheStats.repositories.length,
                },
                websocket: {
                    status: 'error' in webSocketStats ? 'error' : 'operational',
                    connectedClients: webSocketStats.connectedClients,
                    activeRepositories: webSocketStats.activeRepositories,
                    error: 'error' in webSocketStats ? webSocketStats.error : undefined,
                },
            },
        };

        return res.json({
            success: true,
            data: health,
        });
    } catch (error) {
        logger.error('Error getting health status', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get health status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

export default router;