import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production';

export interface JWTPayload {
  userId: string;
  walletAddress?: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
  };
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * JWT authentication middleware
 * Checks for JWT in Authorization header or cookie
 */
export const authenticateJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no token in header, check cookies (for NextAuth compatibility)
    if (!token && req.cookies) {
      token = req.cookies['next-auth.session-token'] || 
              req.cookies['__Secure-next-auth.session-token'];
    }

    if (!token) {
      // Fall back to x-user-id for MVP (remove in production)
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        // Verify user exists in database
        const [user] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, parseInt(userId)))
          .limit(1);

        if (user) {
          req.user = {
            id: userId,
            walletAddress: user.walletAddress || undefined,
            isAdmin: user.isAdmin || false,
          };
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Verify user exists in database
    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, parseInt(decoded.userId)))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      walletAddress: user.walletAddress || undefined,
      isAdmin: user.isAdmin || false,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Admin check middleware
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

/**
 * Optional JWT authentication
 * Attaches user if token is present but doesn't require it
 */
export const optionalJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check cookies for NextAuth token
    if (!token && req.cookies) {
      token = req.cookies['next-auth.session-token'] || 
              req.cookies['__Secure-next-auth.session-token'];
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const [user] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, parseInt(decoded.userId)))
          .limit(1);

        if (user) {
          req.user = {
            id: decoded.userId,
            walletAddress: user.walletAddress || undefined,
            isAdmin: user.isAdmin || false,
          };
        }
      }
    }

    // Fall back to x-user-id for MVP (remove in production)
    if (!req.user) {
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        const [user] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, parseInt(userId)))
          .limit(1);

        if (user) {
          req.user = {
            id: userId,
            walletAddress: user.walletAddress || undefined,
            isAdmin: user.isAdmin || false,
          };
        }
      }
    }

    next();
  } catch (error) {
    // Continue without user on error
    next();
  }
};