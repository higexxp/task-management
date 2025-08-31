import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/github.js';
import { redisService } from '../services/redis.js';
import { generateToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { AuthUser } from '../types/auth.js';
import { config } from '../config/env.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GitHub OAuth initiation endpoint
router.get('/github', (req: Request, res: Response) => {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    const scope = 'repo,read:user,user:email';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${config.github.clientId}&` +
      `redirect_uri=${encodeURIComponent('http://localhost:3000/api/auth/callback')}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;

    logger.info('GitHub OAuth initiation', {
      clientId: config.github.clientId,
      redirectUri: 'http://localhost:3000/api/auth/callback',
      scope
    });

    res.redirect(githubAuthUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Failed to initiate GitHub OAuth', {
      error: errorMessage,
      clientId: config.github.clientId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to initiate GitHub authentication',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// GitHub OAuth callback endpoint
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn('GitHub OAuth error', { error, state });
      return res.redirect('http://localhost:3001?error=oauth_error');
    }

    if (!code) {
      logger.warn('No authorization code received');
      return res.redirect('http://localhost:3001?error=no_code');
    }

    // Create GitHub service for OAuth
    const githubService = new GitHubService();

    // Exchange code for access token
    const accessToken = await githubService.exchangeCodeForToken(code as string);

    // Get user information
    const githubUser = await new GitHubService(accessToken).getCurrentUser();

    // Create user object
    const user: AuthUser = {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name || githubUser.login,
      avatar_url: githubUser.avatar_url,
      access_token: accessToken,
    };

    // Generate JWT token
    const jwtToken = generateToken(user);

    // Store user session in Redis (24 hours)
    await redisService.setSession(`user:${user.id}`, user, 86400);

    logger.info('GitHub OAuth successful', {
      userId: user.id,
      login: user.login
    });

    // Redirect to frontend with token
    res.redirect(`http://localhost:3001?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
    }))}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('GitHub OAuth callback failed', {
      error: errorMessage,
      stack: errorStack,
      query: req.query
    });

    res.redirect(`http://localhost:3001?error=auth_failed&message=${encodeURIComponent(errorMessage)}`);
  }
});

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
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          login: req.user.login,
          name: req.user.name,
          avatar_url: req.user.avatar_url,
        },
        authenticated: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Failed to get user info', {
      error: errorMessage,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (req.user) {
      // Remove session from Redis
      await redisService.deleteSession(`user:${req.user.id}`);

      logger.info('User logged out successfully', {
        userId: req.user.id,
        login: req.user.login
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Logout failed', {
      error: errorMessage,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Demo endpoint with real GitHub connection (for testing with Personal Access Token)
router.post('/demo', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const { username = 'demo-user', token } = req.body;

    let user: AuthUser;

    if (token) {
      // Use provided Personal Access Token to get real GitHub user
      try {
        const githubService = new GitHubService(token);
        const githubUser = await githubService.getCurrentUser();

        user = {
          id: githubUser.id,
          login: githubUser.login,
          name: githubUser.name || githubUser.login,
          avatar_url: githubUser.avatar_url,
          access_token: token,
        };

        logger.info('Demo authentication with real GitHub user', {
          userId: user.id,
          login: user.login
        });
      } catch (error) {
        logger.warn('Failed to authenticate with provided token, using mock user', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Fallback to mock user if token is invalid
        user = {
          id: 12345,
          login: username,
          name: `Demo User (${username})`,
          avatar_url: `https://github.com/${username}.png`,
          access_token: 'demo-token-' + Date.now(),
        };
      }
    } else {
      // Create mock demo user (original behavior)
      user = {
        id: 12345,
        login: username,
        name: `Demo User (${username})`,
        avatar_url: `https://github.com/${username}.png`,
        access_token: 'demo-token-' + Date.now(),
      };
    }

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
        note: token ? 'Demo authentication with real GitHub connection' : 'Demo authentication (mock user)',
        isRealGitHubUser: !!token,
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