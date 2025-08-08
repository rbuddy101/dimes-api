import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    walletAddress?: string;
    isAdmin?: boolean;
  };
}

// Simplified auth check for MVP - in production, integrate with NextAuth
export const authenticateUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  // For MVP, we'll accept a userId in the header or query param
  // In production, this should validate NextAuth session tokens
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authenticated' 
    });
  }

  // Attach user to request
  req.user = {
    id: userId as string,
    // These would be fetched from database in production
    isAdmin: false
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
    req.user = {
      id: userId as string,
      isAdmin: false
    };
  }
  
  next();
};