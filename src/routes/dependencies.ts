import { Router, Request, Response } from 'express';
import { DependencyService, IssueDependency } from '../services/dependency.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';

const router = Router();
const dependencyService = new DependencyService();

// Parse dependencies from issue body text
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { body, repository } = req.body;
    
    if (typeof body !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Body must be a string',
      });
      return;
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
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to parse dependencies', { 
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

// Build dependency graph from multiple issues
router.post('/graph', async (req: Request, res: Response) => {
  try {
    const { issues } = req.body;
    
    if (!Array.isArray(issues)) {
      res.status(400).json({
        success: false,
        error: 'Issues must be an array',
      });
      return;
    }

    // Validate issue format
    for (const issue of issues) {
      if (!issue.issueNumber || !issue.repository || !Array.isArray(issue.dependencies)) {
        res.status(400).json({
          success: false,
          error: 'Each issue must have issueNumber, repository, and dependencies array',
        });
        return;
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
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to build dependency graph', { 
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

// Validate dependencies for potential issues
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { dependencies } = req.body;
    
    if (!Array.isArray(dependencies)) {
      res.status(400).json({
        success: false,
        error: 'Dependencies must be an array',
      });
      return;
    }

    // Validate dependency format
    for (const dep of dependencies) {
      if (!dep.type || !dep.issueNumber || !['depends_on', 'blocks'].includes(dep.type)) {
        res.status(400).json({
          success: false,
          error: 'Each dependency must have type (depends_on|blocks) and issueNumber',
        });
        return;
      }
    }

    const validation = dependencyService.validateDependencies(dependencies);
    
    res.json({
      success: true,
      data: {
        validation,
        dependencies,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to validate dependencies', { 
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

// Generate dependency markdown
router.post('/markdown', async (req: Request, res: Response) => {
  try {
    const { dependencies } = req.body;
    
    if (!Array.isArray(dependencies)) {
      res.status(400).json({
        success: false,
        error: 'Dependencies must be an array',
      });
      return;
    }

    const markdown = dependencyService.generateDependencyMarkdown(dependencies);
    
    res.json({
      success: true,
      data: {
        markdown,
        dependencies,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to generate dependency markdown', { 
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

// Get dependency analysis for a specific issue body (demo endpoint)
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { body, repository } = req.body;
    
    if (typeof body !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Body must be a string',
      });
      return;
    }

    // Parse dependencies
    const dependencies = dependencyService.parseDependenciesFromBody(body, repository);
    
    // Validate dependencies
    const validation = dependencyService.validateDependencies(dependencies);
    
    // Generate markdown
    const markdown = dependencyService.generateDependencyMarkdown(dependencies);
    
    res.json({
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to analyze dependencies', { 
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