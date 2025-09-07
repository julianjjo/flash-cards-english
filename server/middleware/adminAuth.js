import { authenticateToken, requireAdmin } from './auth.js';

// Combine authentication and admin authorization in one middleware
export const adminAuth = [authenticateToken, requireAdmin];

// Individual middleware for more granular control
export const requireAdminRole = requireAdmin;

// Middleware to check if user is admin or accessing their own resources
export const adminOrSelfOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'No user context'
    });
  }

  const targetUserId = parseInt(req.params.userId || req.params.id);
  const currentUserId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Allow if user is admin or accessing their own data
  if (isAdmin || currentUserId === targetUserId) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden',
      error: 'Admin role required or you can only access your own data'
    });
  }
};

// Middleware to prevent self-targeting admin actions
export const preventSelfAction = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'No user context'
    });
  }

  const targetUserId = parseInt(req.params.userId || req.params.id);
  const currentUserId = req.user.id;

  if (currentUserId === targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot perform this action on yourself',
      error: 'Self-targeting actions are not allowed'
    });
  }

  next();
};

// Middleware to validate user ID parameter
export const validateUserId = (req, res, next) => {
  const userId = req.params.userId || req.params.id;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
      error: 'Missing user ID parameter'
    });
  }

  const parsedUserId = parseInt(userId);
  
  if (isNaN(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID format',
      error: 'User ID must be a positive integer'
    });
  }

  // Store parsed ID for use in route handlers
  req.targetUserId = parsedUserId;
  next();
};

// Combined middleware for admin user management endpoints
export const adminUserManagement = [
  authenticateToken,
  requireAdmin,
  validateUserId
];

// Combined middleware for admin user deletion (includes self-prevention)
export const adminUserDeletion = [
  authenticateToken,
  requireAdmin,
  validateUserId,
  preventSelfAction
];

// Logging middleware for admin actions
export const logAdminAction = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the admin action
      const logData = {
        timestamp: new Date().toISOString(),
        admin: {
          id: req.user?.id,
          email: req.user?.email
        },
        action,
        target: {
          userId: req.targetUserId,
          params: req.params,
          body: req.body
        },
        success: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode
      };

      console.log('Admin Action:', JSON.stringify(logData, null, 2));
      
      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};