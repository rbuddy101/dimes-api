import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

/**
 * Common validation schemas for reuse
 */
export const schemas = {
  // ID validation - must be positive integer
  id: Joi.number().integer().positive().required(),
  
  // Competition validation
  competition: {
    id: Joi.number().integer().positive().required(),
    endTime: Joi.date().iso().min('now').optional(),
    prizeText: Joi.string().max(1000).optional(),
    prizeImageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).optional()
  },
  
  // Prize validation
  prize: {
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().min(1).max(1000).required(),
    imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).allow('').optional(),
    isDefault: Joi.boolean().optional(),
    isActive: Joi.boolean().optional()
  },
  
  // Winner selection validation
  winners: {
    winners: Joi.array().items(
      Joi.object({
        userId: Joi.number().integer().positive().required(),
        finalStreak: Joi.number().integer().min(0).optional(),
        position: Joi.number().integer().min(1).max(10).optional()
      })
    ).min(1).max(10).required()
  },
  
  // Pagination validation
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('active', 'ended').optional()
  }
};

/**
 * Validate request params
 */
export const validateParams = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.details.map(d => d.message).join(', ')
      });
    }
    
    req.params = value;
    next();
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error.details.map(d => d.message).join(', ')
      });
    }
    
    req.body = value;
    next();
  };
};

/**
 * Validate request query
 */
export const validateQuery = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.details.map(d => d.message).join(', ')
      });
    }
    
    req.query = value;
    next();
  };
};

/**
 * Sanitize string to prevent XSS
 */
export const sanitizeString = (str: string): string => {
  if (!str) return '';
  
  // Basic HTML entity encoding
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate and sanitize URL
 */
export const validateUrl = (url: string): boolean => {
  if (!url) return true; // Empty is valid
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Prevent javascript: and data: URLs
    if (url.includes('javascript:') || url.includes('data:')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate competition ID exists and belongs to admin operations
 */
export const validateCompetitionAccess = async (competitionId: number, userId: string): Promise<boolean> => {
  // This would check if the competition exists and if the user has permission
  // For now, we'll just validate the ID format
  return competitionId > 0 && !isNaN(competitionId);
};