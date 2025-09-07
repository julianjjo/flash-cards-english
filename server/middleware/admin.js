import AuthService from '../services/AuthService.js';

/**
 * Admin Authorization Middleware
 * 
 * Handles role-based access control for admin-only endpoints.
 * Requires authentication middleware to run first to populate req.user.
 * Provides different levels of admin access control.
 */

/**
 * Require admin role
 * Middleware that checks if the authenticated user has admin privileges
 * Must be used after authentication middleware
 */
export const requireAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check if user has admin role
    if (!AuthService.isAdmin(req.user)) {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges',
        code: 'ADMIN_REQUIRED'
      });
    }

    // User is admin, proceed
    next();

  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'An error occurred during authorization',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Optional admin access
 * Middleware that checks for admin privileges but doesn't require them
 * Useful for endpoints that provide different responses for admin users
 */
export const optionalAdmin = (req, res, next) => {
  try {
    // Add admin flag to request
    req.isAdmin = req.user && req.isAuthenticated && AuthService.isAdmin(req.user);
    next();

  } catch (error) {
    // For optional admin, errors don't block the request
    req.isAdmin = false;
    next();
  }
};

/**
 * Check admin or self access
 * Middleware that allows access if user is admin OR accessing their own resources
 * Requires a userId parameter in the route (e.g., /users/:userId)
 */
export const requireAdminOrSelf = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get target user ID from route parameters
    const targetUserId = req.params.userId || req.params.id;
    
    if (!targetUserId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'User ID parameter is required',
        code: 'USER_ID_REQUIRED'
      });
    }

    // Check if user is admin or accessing their own resource
    if (AuthService.isAdmin(req.user) || AuthService.canAccessUserResource(req.user, targetUserId)) {
      next();
    } else {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources or need admin privileges',
        code: 'ACCESS_DENIED'
      });
    }

  } catch (error) {
    console.error('Admin or self authorization error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'An error occurred during authorization',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Super admin check
 * For operations that require the highest level of admin access
 * Could be extended for different admin levels in the future
 */
export const requireSuperAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check if user has admin role
    if (!AuthService.isAdmin(req.user)) {
      return res.status(403).json({
        error: 'Super admin access required',
        message: 'This endpoint requires super admin privileges',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }

    // For now, all admins are super admins
    // This can be extended later with additional role checks
    next();

  } catch (error) {
    console.error('Super admin authorization error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'An error occurred during authorization',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Role-based access control
 * Generic middleware for checking specific roles
 */
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.isAuthenticated) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to access this resource',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user has required role
      if (!AuthService.hasRole(req.user, requiredRole)) {
        return res.status(403).json({
          error: 'Insufficient privileges',
          message: `This endpoint requires '${requiredRole}' role`,
          code: 'INSUFFICIENT_PRIVILEGES'
        });
      }

      next();

    } catch (error) {
      console.error('Role authorization error:', error);
      res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Admin action logging middleware
 * Logs admin actions for audit trail
 */
export const logAdminAction = (action) => {
  return (req, res, next) => {
    // Only log if user is admin
    if (req.user && AuthService.isAdmin(req.user)) {
      const logData = {
        timestamp: new Date().toISOString(),
        adminId: req.user.id,
        adminEmail: req.user.email,
        action,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      // Add route parameters if present
      if (Object.keys(req.params).length > 0) {
        logData.params = req.params;
      }

      // Add request body for POST/PUT/PATCH (excluding sensitive data)
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        const bodyToLog = { ...req.body };
        // Remove sensitive fields
        delete bodyToLog.password;
        delete bodyToLog.password_hash;
        delete bodyToLog.currentPassword;
        delete bodyToLog.newPassword;
        
        if (Object.keys(bodyToLog).length > 0) {
          logData.requestBody = bodyToLog;
        }
      }

      // Log the action (in production, this would go to a secure audit log)
      console.log('ADMIN_ACTION:', JSON.stringify(logData));

      // Store log data in request for potential use by routes
      req.adminActionLog = logData;
    }

    next();
  };
};

/**
 * Prevent admin self-harm actions
 * Prevents admin users from performing potentially harmful actions on their own account
 */
export const preventAdminSelfHarm = (req, res, next) => {
  try {
    // Only check for admin users
    if (!req.user || !AuthService.isAdmin(req.user)) {
      return next();
    }

    // Get target user ID from route parameters
    const targetUserId = req.params.userId || req.params.id;
    
    // If targeting themselves, check for harmful actions
    if (targetUserId && Number(targetUserId) === Number(req.user.id)) {
      const harmfulMethods = ['DELETE'];
      const harmfulActions = ['/demote', '/deactivate', '/suspend'];
      
      // Check for harmful HTTP methods
      if (harmfulMethods.includes(req.method)) {
        return res.status(403).json({
          error: 'Self-harm prevention',
          message: 'Admins cannot delete their own account',
          code: 'ADMIN_SELF_HARM_PREVENTED'
        });
      }

      // Check for harmful action endpoints
      const isHarmfulAction = harmfulActions.some(action => 
        req.originalUrl.includes(action)
      );

      if (isHarmfulAction) {
        return res.status(403).json({
          error: 'Self-harm prevention',
          message: 'Admins cannot perform this action on their own account',
          code: 'ADMIN_SELF_HARM_PREVENTED'
        });
      }

      // Check for role demotion in request body
      if (req.body && req.body.role === 'user') {
        return res.status(403).json({
          error: 'Self-harm prevention',
          message: 'Admins cannot demote themselves',
          code: 'ADMIN_SELF_HARM_PREVENTED'
        });
      }
    }

    next();

  } catch (error) {
    console.error('Admin self-harm prevention error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'An error occurred during authorization',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

/**
 * Validate admin operations
 * Ensures admin operations have proper justification and validation
 */
export const validateAdminOperation = (req, res, next) => {
  try {
    // Only validate for admin users performing sensitive operations
    if (!req.user || !AuthService.isAdmin(req.user)) {
      return next();
    }

    const sensitiveOperations = ['DELETE', 'PUT', 'PATCH'];
    
    if (sensitiveOperations.includes(req.method)) {
      // Log the operation attempt
      console.log(`Admin operation attempt: ${req.user.email} performing ${req.method} on ${req.originalUrl}`);
      
      // Add operation metadata to request
      req.adminOperation = {
        type: req.method,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString(),
        adminId: req.user.id
      };
    }

    next();

  } catch (error) {
    console.error('Admin operation validation error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'An error occurred during authorization',
      code: 'AUTHORIZATION_ERROR'
    });
  }
};

export default {
  requireAdmin,
  optionalAdmin,
  requireAdminOrSelf,
  requireSuperAdmin,
  requireRole,
  logAdminAction,
  preventAdminSelfHarm,
  validateAdminOperation
};