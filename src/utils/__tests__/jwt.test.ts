import { generateToken, verifyToken } from '../jwt';
import { AuthUser } from '../../types/auth';

describe('JWT Utils', () => {
  const mockUser: AuthUser = {
    id: 123,
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://github.com/avatar.jpg',
    access_token: 'github-token',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.login).toBe(mockUser.login);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid-token');
      }).toThrow();
    });
  });
});