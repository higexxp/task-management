import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/github.js';
import { MetadataService } from '../services/metadata.js';
import { timeTrackingService, TimeEntry } from '../services/timeTracking.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const githubService = new GitHubService();
const metadataService = new MetadataService();

/**
 * Get time tracking report for a repository
 */
router.get('/:owner/:repo/report', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { period = '30d' } = req.query;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting time tracking report', { owner, repo, period });

    // Check cache first
    const cacheKey = redisService.getCacheKey('time-tracking', 'report', owner, repo, period as string);
    const cached = await redisService.get<any>(cacheKey);
    if (cached) {
        logger.debug('Returning cached time tracking report');
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

    // Calculate time report
    const report = timeTrackingService.calculateTimeReport(issues);

    // Cache the result
    await redisService.set(cacheKey, JSON.stringify(report), 300); // 5 minutes cache

    return res.json({
        success: true,
        data: report,
        cached: false,
    });
}));

/**
 * Get time tracking summary for a specific issue
 */
router.get('/:owner/:repo/issues/:number/time', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo, number } = req.params;

    if (!owner || !repo || !number) {
        return res.status(400).json({
            success: false,
            error: 'Owner, repo, and issue number are required',
        });
    }

    logger.info('Getting issue time summary', { owner, repo, number });

    // Get the specific issue
    const issue = await githubService.getIssue(owner, repo, parseInt(number));

    // Get time summary
    const timeSummary = timeTrackingService.getIssueSummary(issue.labels || []);

    return res.json({
        success: true,
        data: {
            issue: {
                number: issue.number,
                title: issue.title,
                state: issue.state,
            },
            timeSummary,
        },
    });
}));

export default router;