import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/github.js';
import { redisService } from '../services/redis.js';
import { generateToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { AuthUser } from '../types/auth.js';

const router = Router();

// GitHub OAuth callback (simplified for demo)
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
      return;
    }

    // Create GitHub service for OAuth
    const githubService = new GitHubService();

    // Exchange code for access token
    const accessToken = await githubService.exchangeCodeForToken(code);

    // Get user information
    const githubUser = await new GitHubService(accessToken).getCurrentUser();

    // Create user object
    const user: AuthUser = {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.login, // GitHub API might not always return name
      avatar_url: githubUser.avatar_url,
      access_token: accessToken,
    };

    // Generate JWT token
    const jwtToken = generateToken(user);

    // Store user session in Redis (24 hours)
    await redisService.setSession(`user:${user.id}`, user, 86400);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
        },
        token: jwtToken,
        expiresIn: '7d',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('GitHub OAuth failed', { 
      error: errorMessage,
      stack: errorStack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Get current user info
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
      });
      return;
    }

    // For demo purposes, we'll create a mock user
    // In a real implementation, you'd verify the JWT and get user from Redis
    const mockUser = {
      id: 12345,
      login: 'demo-user',
      name: 'Demo User',
      avatar_url: 'https://github.com/demo-user.png',
    };

    res.json({
      success: true,
      data: {
        user: mockUser,
        authenticated: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Failed to get user info', { 
      error: errorMessage,
      headers: req.headers
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // In a real implementation, you'd decode the JWT to get user ID
      // and remove the session from Redis
      // For now, we'll just return success
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Logout failed', { 
      error: errorMessage,
      headers: req.headers
    });
    
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Demo endpoint to simulate authentication (for testing without GitHub OAuth)
router.post('/demo', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const { username = 'demo-user' } = req.body;

    // Create demo user
    const user: AuthUser = {
      id: 12345,
      login: username,
      name: `Demo User (${username})`,
      avatar_url: `https://github.com/${username}.png`,
      access_token: 'demo-token-' + Date.now(),
    };

    // Generate JWT token
    const jwtToken = generateToken(user);

    // Store user session in Redis (24 hours)
    await redisService.setSession(`user:${user.id}`, user, 86400);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
        },
        token: jwtToken,
        expiresIn: '7d',
        note: 'This is a demo authentication for development only',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Demo auth failed', { 
      error: errorMessage,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Demo authentication failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

export default router;