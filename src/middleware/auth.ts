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

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      const sessionData = await redisService.getSession<AuthUser>(`user:${decoded.userId}`);
      
      if (sessionData) {
        req.user = sessionData;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};