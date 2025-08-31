import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/github.js';
import { MetadataService } from '../services/metadata.js';
import { workloadService, WorkloadSettings } from '../services/workload.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const githubService = new GitHubService();
const metadataService = new MetadataService();

/**
 * Get workload metrics for a repository
 */
router.get('/:owner/:repo', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { settings } = req.query;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting workload metrics', { owner, repo });

    try {
        // Check cache first
        const cacheKey = redisService.getCacheKey('workload', owner, repo, settings as string || 'default');
        const cached = await redisService.get<any>(cacheKey);
        if (cached) {
            logger.debug('Returning cached workload metrics');
            return res.json({
                success: true,
                data: JSON.parse(cached),
                cached: true,
            });
        }

        // Get all issues for the repository
        const issues = await githubService.getRepositoryIssues(owner, repo, {
            state: 'all',
            per_page: 100,
        });

        // Extract metadata for all issues
        const issuesWithMetadata = issues.map(issue => ({
            ...issue,
            metadata: metadataService.extractMetadataFromLabels(issue.labels || []),
        }));

        // Parse settings if provided
        let workloadSettings: WorkloadSettings | undefined;
        if (settings && typeof settings === 'string') {
            try {
                workloadSettings = JSON.parse(settings);
            } catch (error) {
                logger.warn('Invalid workload settings provided', { settings });
            }
        }

        // Calculate team workload
        const teamWorkload = workloadService.calculateTeamWorkload(issuesWithMetadata, workloadSettings);

        // Generate rebalancing suggestions
        const rebalancingSuggestions = workloadService.generateRebalancingSuggestions(teamWorkload);

        const result = {
            teamWorkload,
            rebalancingSuggestions,
            timestamp: new Date().toISOString(),
        };

        // Cache the result
        await redisService.set(cacheKey, JSON.stringify(result), 300); // 5 minutes cache

        return res.json({
            success: true,
            data: result,
            cached: false,
        });
    } catch (error) {
        logger.error('Failed to get workload metrics', {
            owner,
            repo,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get workload metrics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get workload metrics for a specific team member
 */
router.get('/:owner/:repo/member/:assignee', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo, assignee } = req.params;
    const { settings } = req.query;

    if (!owner || !repo || !assignee) {
        return res.status(400).json({
            success: false,
            error: 'Owner, repo, and assignee parameters are required',
        });
    }

    logger.info('Getting member workload metrics', { owner, repo, assignee });

    try {
        // Check cache first
        const cacheKey = redisService.getCacheKey('workload', 'member', owner, repo, assignee, settings as string || 'default');
        const cached = await redisService.get<any>(cacheKey);
        if (cached) {
            logger.debug('Returning cached member workload metrics');
            return res.json({
                success: true,
                data: JSON.parse(cached),
                cached: true,
            });
        }

        // Get all issues for the repository
        const issues = await githubService.getRepositoryIssues(owner, repo, {
            state: 'all',
            per_page: 100,
        });

        // Extract metadata for all issues
        const issuesWithMetadata = issues.map(issue => ({
            ...issue,
            metadata: metadataService.extractMetadataFromLabels(issue.labels || []),
        }));

        // Parse settings if provided
        let workloadSettings: WorkloadSettings | undefined;
        if (settings && typeof settings === 'string') {
            try {
                workloadSettings = JSON.parse(settings);
            } catch (error) {
                logger.warn('Invalid workload settings provided', { settings });
            }
        }

        // Calculate member workload
        const memberWorkload = workloadService.calculateMemberWorkload(assignee, issuesWithMetadata, workloadSettings);

        // Get member's issues for detailed analysis
        const memberIssues = issuesWithMetadata.filter(issue =>
            issue.assignees?.some(a => a.login === assignee)
        );

        const result = {
            memberWorkload,
            issues: memberIssues,
            timestamp: new Date().toISOString(),
        };

        // Cache the result
        await redisService.set(cacheKey, JSON.stringify(result), 300); // 5 minutes cache

        return res.json({
            success: true,
            data: result,
            cached: false,
        });
    } catch (error) {
        logger.error('Failed to get member workload metrics', {
            owner,
            repo,
            assignee,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get member workload metrics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get workload trends over time
 */
router.get('/:owner/:repo/trends', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { period = '30d', settings } = req.query;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting workload trends', { owner, repo, period });

    try {
        // Check cache first
        const cacheKey = redisService.getCacheKey('workload', 'trends', owner, repo, period as string, settings as string || 'default');
        const cached = await redisService.get<any>(cacheKey);
        if (cached) {
            logger.debug('Returning cached workload trends');
            return res.json({
                success: true,
                data: JSON.parse(cached),
                cached: true,
            });
        }

        // For now, return mock trend data
        // In a real implementation, you would fetch historical snapshots
        const now = new Date();
        const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;

        const trends = [];
        for (let i = periodDays; i >= 0; i -= Math.ceil(periodDays / 10)) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            trends.push({
                date: date.toISOString().split('T')[0],
                workloadBalance: 0.7 + Math.random() * 0.3, // Mock data
                overloadedCount: Math.floor(Math.random() * 3),
                totalMembers: 5 + Math.floor(Math.random() * 3),
                averageIssuesPerMember: 5 + Math.random() * 5,
            });
        }

        const result = {
            trends,
            period,
            timestamp: new Date().toISOString(),
        };

        // Cache the result
        await redisService.set(cacheKey, JSON.stringify(result), 600); // 10 minutes cache

        return res.json({
            success: true,
            data: result,
            cached: false,
        });
    } catch (error) {
        logger.error('Failed to get workload trends', {
            owner,
            repo,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get workload trends',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Update workload settings
 */
router.post('/:owner/:repo/settings', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const settings = req.body;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Updating workload settings', { owner, repo, settings });

    try {
        // Validate settings
        const validation = workloadService.validateSettings(settings);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid workload settings',
                details: validation.errors,
            });
        }

        // Store settings in cache/database
        const settingsKey = redisService.getCacheKey('workload', 'settings', owner, repo);
        await redisService.set(settingsKey, JSON.stringify(settings), 86400); // 24 hours

        // Clear related caches
        const cachePattern = redisService.getCacheKey('workload', owner, repo, '*');
        // Note: In a real implementation, you'd want to clear all matching cache keys

        return res.json({
            success: true,
            message: 'Workload settings updated successfully',
            settings,
        });
    } catch (error) {
        logger.error('Failed to update workload settings', {
            owner,
            repo,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to update workload settings',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Get workload settings
 */
router.get('/:owner/:repo/settings', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting workload settings', { owner, repo });

    try {
        const settingsKey = redisService.getCacheKey('workload', 'settings', owner, repo);
        const settings = await redisService.get<any>(settingsKey);

        if (settings) {
            return res.json({
                success: true,
                data: JSON.parse(settings),
                cached: true,
            });
        } else {
            // Return default settings
            return res.json({
                success: true,
                data: {
                    maxIssuesPerMember: 10,
                    maxHoursPerMember: 40,
                    sizeToHoursMapping: {
                        small: 2,
                        medium: 8,
                        large: 20,
                    },
                    overloadThreshold: 150,
                    underloadThreshold: 50,
                },
                cached: false,
            });
        }
    } catch (error) {
        logger.error('Failed to get workload settings', {
            owner,
            repo,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to get workload settings',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

/**
 * Generate workload rebalancing suggestions
 */
router.post('/:owner/:repo/rebalance', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { settings } = req.body;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Generating workload rebalancing suggestions', { owner, repo });

    try {
        // Get all issues for the repository
        const issues = await githubService.getRepositoryIssues(owner, repo, {
            state: 'all',
            per_page: 100,
        });

        // Extract metadata for all issues
        const issuesWithMetadata = issues.map(issue => ({
            ...issue,
            metadata: metadataService.extractMetadataFromLabels(issue.labels || []),
        }));

        // Calculate team workload
        const teamWorkload = workloadService.calculateTeamWorkload(issuesWithMetadata, settings);

        // Generate rebalancing suggestions
        const rebalancingSuggestions = workloadService.generateRebalancingSuggestions(teamWorkload);

        return res.json({
            success: true,
            data: {
                currentWorkload: teamWorkload,
                suggestions: rebalancingSuggestions,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to generate rebalancing suggestions', {
            owner,
            repo,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to generate rebalancing suggestions',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

export default router;