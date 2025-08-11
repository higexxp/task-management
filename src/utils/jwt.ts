import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JWTPayload, AuthUser } from '../types/auth.js';

export const generateToken = (user: AuthUser): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    login: user.login,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
};