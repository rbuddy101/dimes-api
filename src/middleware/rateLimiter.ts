import rateLimit from 'express-rate-limit';

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV === 'development',
  // Use default key generator which respects trust proxy setting
  keyGenerator: (req) => req.ip || 'unknown',
});

// Specific rate limiter for coin flip endpoint
export const flipRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 120, // 120 flips per minute (same as original)
  message: 'Too fast! Please wait a moment before flipping again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV === 'development',
  // Use default key generator which respects trust proxy setting
  keyGenerator: (req) => req.ip || 'unknown',
});