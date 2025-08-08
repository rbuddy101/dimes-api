import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface SecureAuthRequest extends Request {
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
    isVerified?: boolean;
  };
  csrfToken?: string;
}

// Cache for user admin status to reduce DB hits (TTL: 5 minutes)
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Secure JWT-based authentication middleware
 * Validates NextAuth JWT tokens and verifies admin status from database
 */
export const authenticateSecure = async (req: SecureAuthRequest, res: Response, next: NextFunction) => {
  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    // Verify JWT token with NextAuth secret
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('NEXTAUTH_SECRET not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    // Decode and verify the JWT
    const encoder = new TextEncoder();
    const { payload } = await jwtVerify(
      token,
      encoder.encode(secret),
      {
        algorithms: ['HS256']
      }
    );

    // Validate required token claims
    if (!payload.id || typeof payload.id !== 'string') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token: missing user ID' 
      });
    }

    // Check token expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired' 
      });
    }

    const userId = payload.id;

    // Check admin status cache
    const cached = adminCache.get(userId);
    let isAdmin = false;
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Use cached admin status
      isAdmin = cached.isAdmin;
    } else {
      // Fetch current admin status from database
      try {
        const [user] = await db
          .select({ 
            id: userProfiles.id,
            isAdmin: userProfiles.isAdmin
          })
          .from(userProfiles)
          .where(eq(userProfiles.id, Number(userId)))
          .limit(1);
        
        if (!user) {
          return res.status(401).json({ 
            success: false, 
            error: 'User not found' 
          });
        }

        isAdmin = user.isAdmin || false;
        
        // Update cache
        adminCache.set(userId, { 
          isAdmin, 
          timestamp: Date.now() 
        });
      } catch (dbError) {
        console.error('Database error checking admin status:', dbError);
        return res.status(500).json({ 
          success: false, 
          error: 'Database error' 
        });
      }
    }

    // Attach verified user info to request
    req.user = {
      id: userId,
      walletAddress: payload.walletAddress as string | undefined,
      isAdmin,
      isVerified: payload.isVerified as boolean | undefined
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Specific error handling
    if (error instanceof Error) {
      if (error.message.includes('signature')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid token signature' 
        });
      }
      if (error.message.includes('expired')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Token has expired' 
        });
      }
    }
    
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

/**
 * Admin authorization middleware
 * Must be used after authenticateSecure
 */
export const requireAdminSecure = (req: SecureAuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authenticated' 
    });
  }

  if (!req.user.isAdmin) {
    // Log potential unauthorized access attempt
    console.warn(`Unauthorized admin access attempt by user ${req.user.id} from IP ${req.ip}`);
    
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that have different behavior for authenticated users
 */
export const optionalAuthSecure = async (req: SecureAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, just continue without user
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  // If auth header exists, validate it properly
  return authenticateSecure(req, res, next);
};

/**
 * Clear admin cache for a specific user
 * Should be called when admin status changes
 */
export const clearAdminCache = (userId: string) => {
  adminCache.delete(userId);
};

/**
 * Clear entire admin cache
 * Useful for testing or when bulk admin changes occur
 */
export const clearAllAdminCache = () => {
  adminCache.clear();
};