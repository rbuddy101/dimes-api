import rateLimit from 'express-rate-limit';
import { SecureAuthRequest } from '../utils/auth-secure';

/**
 * Rate limiter specifically for admin endpoints
 * More restrictive than general endpoints to prevent abuse
 */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 requests per minute per user
  message: 'Too many admin requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  
  // Use user ID for rate limiting if authenticated, otherwise use IP
  keyGenerator: (req) => {
    const authReq = req as SecureAuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  },
  
  // Skip successful requests to be more lenient
  skipSuccessfulRequests: false,
  
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    const authReq = req as SecureAuthRequest;
    console.warn(`Admin rate limit exceeded for user ${authReq.user?.id || 'unknown'} from IP ${req.ip}`);
    
    res.status(429).json({
      success: false,
      error: 'Too many admin requests. Please wait before trying again.',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Strict rate limiter for sensitive admin operations
 * Used for operations that modify data or access sensitive information
 */
export const strictAdminRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 10, // 10 requests per 5 minutes
  message: 'Too many sensitive admin operations. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    const authReq = req as SecureAuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  },
  
  skipSuccessfulRequests: false,
  
  handler: (req, res) => {
    const authReq = req as SecureAuthRequest;
    console.error(`STRICT admin rate limit exceeded for user ${authReq.user?.id || 'unknown'} from IP ${req.ip}`);
    
    res.status(429).json({
      success: false,
      error: 'Too many sensitive operations. Please wait 5 minutes before trying again.',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});