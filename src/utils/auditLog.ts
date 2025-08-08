import { db } from '../db';
import { SecureAuthRequest } from './auth-secure';

// In-memory audit log for now (in production, use a proper database table)
// Consider creating an audit_logs table in your database
const auditLogs: AuditLog[] = [];

interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an admin action for audit trail
 */
export const logAdminAction = async (
  req: SecureAuthRequest,
  action: string,
  resource: string,
  resourceId?: string | number,
  details?: any,
  success: boolean = true,
  errorMessage?: string
) => {
  const log: AuditLog = {
    userId: req.user?.id || 'unknown',
    action,
    resource,
    resourceId,
    details,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date(),
    success,
    errorMessage
  };

  // Add to in-memory log
  auditLogs.push(log);

  // In production, save to database
  // await db.insert(auditLogs).values(log);

  // Log to console for monitoring
  console.log(`[AUDIT] ${success ? '✓' : '✗'} User ${log.userId} ${action} ${resource}${resourceId ? `/${resourceId}` : ''} from ${log.ipAddress}`);
  
  if (!success && errorMessage) {
    console.error(`[AUDIT ERROR] ${errorMessage}`);
  }

  // Keep only last 1000 logs in memory
  if (auditLogs.length > 1000) {
    auditLogs.shift();
  }
};

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = (
  userId?: string,
  action?: string,
  resource?: string,
  limit: number = 100
): AuditLog[] => {
  let logs = [...auditLogs];

  if (userId) {
    logs = logs.filter(log => log.userId === userId);
  }
  
  if (action) {
    logs = logs.filter(log => log.action === action);
  }
  
  if (resource) {
    logs = logs.filter(log => log.resource === resource);
  }

  // Sort by most recent first
  logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return logs.slice(0, limit);
};

/**
 * Audit log actions enum for consistency
 */
export enum AdminAction {
  // Competition actions
  CREATE_COMPETITION = 'CREATE_COMPETITION',
  END_COMPETITION = 'END_COMPETITION',
  UPDATE_COMPETITION = 'UPDATE_COMPETITION',
  SELECT_WINNERS = 'SELECT_WINNERS',
  AUTO_SELECT_WINNERS = 'AUTO_SELECT_WINNERS',
  MARK_PRIZE_DELIVERED = 'MARK_PRIZE_DELIVERED',
  
  // Prize actions
  CREATE_PRIZE = 'CREATE_PRIZE',
  UPDATE_PRIZE = 'UPDATE_PRIZE',
  DELETE_PRIZE = 'DELETE_PRIZE',
  SET_DEFAULT_PRIZE = 'SET_DEFAULT_PRIZE',
  
  // Settings actions
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  
  // Security actions
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN'
}

/**
 * Middleware to automatically log admin actions
 */
export const auditMiddleware = (action: string, resource: string) => {
  return async (req: SecureAuthRequest, res: any, next: any) => {
    const resourceId = req.params.id;
    const originalSend = res.send;
    
    // Intercept response to log success/failure
    res.send = function(data: any) {
      const success = res.statusCode < 400;
      let parsedData;
      
      try {
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        parsedData = data;
      }
      
      logAdminAction(
        req,
        action,
        resource,
        resourceId,
        { 
          requestBody: req.body,
          responseStatus: res.statusCode 
        },
        success,
        !success ? parsedData?.error : undefined
      );
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};