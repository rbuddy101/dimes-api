import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
  };
}

// Simplified auth check for MVP - in production, integrate with NextAuth
export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // For MVP, we'll accept a userId in the header or query param
  // In production, this should validate NextAuth session tokens
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authenticated' 
    });
  }

  // Check if admin flag is sent from frontend (from session)
  const isAdminHeader = req.headers['x-is-admin'] === 'true';
  
  let isAdminUser = isAdminHeader;
  
  // If userId is numeric, try to fetch from database
  if (!isNaN(Number(userId))) {
    try {
      const [user] = await db
        .select({ isAdmin: userProfiles.isAdmin })
        .from(userProfiles)
        .where(eq(userProfiles.id, Number(userId)))
        .limit(1);
      
      if (user) {
        isAdminUser = user.isAdmin || isAdminHeader;
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  }
  
  // Also check hardcoded admin IDs for development
  const adminIds = ['1', 'admin', process.env.ADMIN_USER_ID].filter(Boolean);
  isAdminUser = isAdminUser || adminIds.includes(userId as string);

  // Attach user to request
  req.user = {
    id: userId as string,
    isAdmin: isAdminUser
  };

  next();
};

// Admin check middleware
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }
  next();
};

// Optional auth - attaches user if present but doesn't require it
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (userId) {
    // Check if admin flag is sent (temporary for MVP)
    const isAdminHeader = req.headers['x-is-admin'] === 'true';
    
    // In production, you would check the database for admin status
    const adminIds = ['1', 'admin', process.env.ADMIN_USER_ID].filter(Boolean);
    const isAdminUser = adminIds.includes(userId as string) || isAdminHeader;
    
    req.user = {
      id: userId as string,
      isAdmin: isAdminUser
    };
  }
  
  next();
};