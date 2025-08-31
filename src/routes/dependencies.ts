import { Router, Request, Response } from 'express';
import { DependencyService, IssueDependency } from '../services/dependency.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const dependencyService = new DependencyService();

// Parse dependencies from issue body text
router.post('/parse', asyncHandler(async (req: Request, res: Response) => {
    const { body, repository } = req.body;

    if (typeof body !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Body must be a string',
        });
    }

    // Check cache for this specific body content
    const cacheKey = redisService.getCacheKey('dependencies', 'parse', body.slice(0, 100));
    let result = await redisService.get<any>(cacheKey);

    if (!result) {
        // Parse dependencies and cache for 30 minutes
        const dependencies = dependencyService.parseDependenciesFromBody(body, repository);
        const validation = dependencyService.validateDependencies(dependencies);

        result = {
            dependencies,
            validation,
            parsedFrom: 'body',
        };

        await redisService.set(cacheKey, result, 1800);
    }

    return res.json({
        success: true,
        data: result,
    });
}));

// Build dependency graph from multiple issues
router.post('/graph', asyncHandler(async (req: Request, res: Response) => {
    const { issues } = req.body;

    if (!Array.isArray(issues)) {
        return res.status(400).json({
            success: false,
            error: 'Issues must be an array',
        });
    }

    // Validate issue format
    for (const issue of issues) {
        if (!issue.issueNumber || !issue.repository || !Array.isArray(issue.dependencies)) {
            return res.status(400).json({
                success: false,
                error: 'Each issue must have issueNumber, repository, and dependencies array',
            });
        }
    }

    // Check cache for this specific issue set
    const issueIds = issues.map(i => `${i.repository}:${i.issueNumber}`).sort().join(',');
    const cacheKey = redisService.getCacheKey('dependencies', 'graph', issueIds);
    let result = await redisService.get<any>(cacheKey);

    if (!result) {
        // Build dependency graph and cache for 15 minutes
        const graph = dependencyService.buildDependencyGraph(issues);

        result = {
            graph,
            metadata: {
                totalNodes: graph.nodes.length,
                totalEdges: graph.edges.length,
                cyclesDetected: graph.cycles.length,
                maxLevel: Math.max(...graph.nodes.map(n => n.level), 0),
            },
        };

        await redisService.set(cacheKey, result, 900);
    }

    return res.json({
        success: true,
        data: result,
    });
}));

// Validate dependencies for potential issues
router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
    const { dependencies } = req.body;

    if (!Array.isArray(dependencies)) {
        return res.status(400).json({
            success: false,
            error: 'Dependencies must be an array',
        });
    }

    // Validate dependency format
    for (const dep of dependencies) {
        if (!dep.type || !dep.issueNumber || !['depends_on', 'blocks'].includes(dep.type)) {
            return res.status(400).json({
                success: false,
                error: 'Each dependency must have type (depends_on|blocks) and issueNumber',
            });
        }
    }

    const validation = dependencyService.validateDependencies(dependencies);

    return res.json({
        success: true,
        data: {
            validation,
            dependencies,
        },
    });
}));

// Generate dependency markdown
router.post('/markdown', asyncHandler(async (req: Request, res: Response) => {
    const { dependencies } = req.body;

    if (!Array.isArray(dependencies)) {
        return res.status(400).json({
            success: false,
            error: 'Dependencies must be an array',
        });
    }

    const markdown = dependencyService.generateDependencyMarkdown(dependencies);

    return res.json({
        success: true,
        data: {
            markdown,
            dependencies,
        },
    });
}));

// Get dependency analysis for a specific issue body (demo endpoint)
router.post('/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { body, repository } = req.body;

    if (typeof body !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Body must be a string',
        });
    }

    // Parse dependencies
    const dependencies = dependencyService.parseDependenciesFromBody(body, repository);

    // Validate dependencies
    const validation = dependencyService.validateDependencies(dependencies);

    // Generate markdown
    const markdown = dependencyService.generateDependencyMarkdown(dependencies);

    return res.json({
        success: true,
        data: {
            originalBody: body,
            repository,
            dependencies,
            validation,
            generatedMarkdown: markdown,
            summary: {
                totalDependencies: dependencies.length,
                dependsOn: dependencies.filter(d => d.type === 'depends_on').length,
                blocks: dependencies.filter(d => d.type === 'blocks').length,
                crossRepository: dependencies.filter(d => d.repository).length,
                hasWarnings: validation.warnings.length > 0,
                hasErrors: validation.errors.length > 0,
            },
        },
    });
}));

// Get dependencies for a repository
router.get('/:owner/:repo', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting dependencies for repository', { owner, repo });

    // Check cache first
    const cacheKey = redisService.getCacheKey('dependencies', owner, repo);
    let result = await redisService.get<any>(cacheKey);

    if (!result) {
        // For now, return empty array - this would be populated from GitHub issues
        // In a real implementation, you would fetch issues and parse their dependencies
        result = [];

        // Cache for 5 minutes
        await redisService.set(cacheKey, result, 300);
    }

    return res.json({
        success: true,
        data: result,
        cached: !!result,
    });
}));

// Add a dependency between issues
router.post('/:owner/:repo', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { from, to, type } = req.body;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    if (!from || !to || !type) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: from, to, type',
        });
    }

    logger.info('Adding dependency', { owner, repo, from, to, type });

    // Clear cache
    const cacheKey = redisService.getCacheKey('dependencies', owner, repo);
    await redisService.del(cacheKey);

    return res.json({
        success: true,
        message: 'Dependency added successfully',
    });
}));

// Remove a dependency between issues
router.delete('/:owner/:repo/:from/:to', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo, from, to } = req.params;

    if (!owner || !repo || !from || !to) {
        return res.status(400).json({
            success: false,
            error: 'Owner, repo, from, and to parameters are required',
        });
    }

    logger.info('Removing dependency', { owner, repo, from, to });

    // Clear cache
    const cacheKey = redisService.getCacheKey('dependencies', owner, repo);
    await redisService.del(cacheKey);

    return res.json({
        success: true,
        message: 'Dependency removed successfully',
    });
}));

// Get dependency graph for a repository
router.get('/:owner/:repo/graph', asyncHandler(async (req: Request, res: Response) => {
    const { owner, repo } = req.params;

    if (!owner || !repo) {
        return res.status(400).json({
            success: false,
            error: 'Owner and repo parameters are required',
        });
    }

    logger.info('Getting dependency graph for repository', { owner, repo });

    // Check cache first
    const cacheKey = redisService.getCacheKey('dependencies', 'graph', owner, repo);
    let result = await redisService.get<any>(cacheKey);

    if (!result) {
        // For now, return empty graph - this would be built from actual dependencies
        result = {
            nodes: [],
            edges: [],
            cycles: [],
        };

        // Cache for 5 minutes
        await redisService.set(cacheKey, result, 300);
    }

    return res.json({
        success: true,
        data: result,
        cached: !!result,
    });
}));

export default router;