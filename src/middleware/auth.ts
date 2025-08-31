import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { redisService } from '../services/redis.js';
import { JWTPayload, AuthUser } from '../types/auth.js';
import { logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // Check if session exists in Redis
    const sessionData = await redisService.getSession<AuthUser>(`user:${decoded.userId}`);
    
    if (!sessionData) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    req.user = sessionData;
    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(403).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    logger.info('Optional auth middleware', {
      hasAuthHeader: !!authHeader,
      tokenPreview: token ? token.substring(0, 10) + '...' : 'none'
    });

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      logger.info('JWT decoded', { userId: decoded.userId });
      
      const sessionData = await redisService.getSession<AuthUser>(`user:${decoded.userId}`);
      logger.info('Session lookup', { 
        userId: decoded.userId,
        foundSession: !!sessionData 
      });
      
      if (sessionData) {
        req.user = sessionData;
        logger.info('User authenticated', { 
          userId: sessionData.id,
          login: sessionData.login 
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth error', { error });
    // Continue without authentication for optional auth
    next();
  }
};