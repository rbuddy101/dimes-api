import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

// Use the same secret as NextAuth
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

export interface NextAuthToken {
  name?: string;
  email?: string;
  picture?: string;
  sub?: string; // User ID
  iat?: number;
  exp?: number;
  jti?: string;
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
  };
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
  };
}

/**
 * Decode and verify NextAuth JWT token
 * NextAuth uses HS256 algorithm by default
 */
export function verifyNextAuthToken(token: string): NextAuthToken | null {
  try {
    // NextAuth JWT tokens are signed with NEXTAUTH_SECRET
    const decoded = jwt.verify(token, NEXTAUTH_SECRET, {
      algorithms: ['HS256']
    }) as NextAuthToken;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware to validate NextAuth session across domains
 * Accepts token in multiple ways for flexibility
 */
export const authenticateNextAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer token (preferred for API calls)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Check for NextAuth session token in cookies (if cookies are forwarded)
    if (!token && req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies['next-auth.session-token'] || 
              cookies['__Secure-next-auth.session-token'] ||
              cookies['__Host-next-auth.session-token'];
    }

    // 3. Check custom header (for debugging or special cases)
    if (!token) {
      token = req.headers['x-nextauth-token'] as string;
    }

    // For development/MVP: Fall back to simple x-user-id
    // IMPORTANT: Remove this in production!
    if (!token) {
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
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify the NextAuth JWT token
    const decoded = verifyNextAuthToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Extract user ID from token
    const userId = decoded.sub || decoded.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token structure',
      });
    }

    // Verify user exists in database
    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, parseInt(userId)))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Attach user info to request
    req.user = {
      id: userId,
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
 * Optional authentication - doesn't fail if no token
 */
export const optionalNextAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Check for token in various places
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies['next-auth.session-token'] || 
              cookies['__Secure-next-auth.session-token'];
    }

    if (!token) {
      token = req.headers['x-nextauth-token'] as string;
    }

    // For development: Check x-user-id
    if (!token) {
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
    } else {
      // Verify NextAuth token
      const decoded = verifyNextAuthToken(token);
      if (decoded) {
        const userId = decoded.sub || decoded.user?.id;
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
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Parse cookies from cookie header string
 */
function parseCookies(cookieHeader: string): { [key: string]: string } {
  const cookies: { [key: string]: string } = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}