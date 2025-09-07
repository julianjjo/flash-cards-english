import AuthService from '../services/AuthService.js';

/**
 * Authentication Middleware
 * 
 * Handles JWT token verification and user authentication.
 * Extracts user information from access tokens and adds to request object.
 * Provides different authentication levels (required, optional).
 */

/**
 * Require valid authentication
 * Middleware that validates JWT access token and adds user data to req.user
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    // Verify access token
    const user = await AuthService.verifyAccessToken(token);
    
    // Add user data to request object
    req.user = user;
    req.isAuthenticated = true;

    next();

  } catch (error) {
    // Handle specific authentication errors
    if (error.message === 'Access token expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Access token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message === 'Invalid access token') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Access token is invalid',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.message === 'User not found') {
      return res.status(401).json({
        error: 'User not found',
        message: 'User associated with token no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generic authentication error
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate request',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Optional authentication
 * Middleware that validates JWT token if present but doesn't require it
 * Useful for endpoints that provide different responses for authenticated users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      req.user = null;
      req.isAuthenticated = false;
      return next();
    }

    // Verify access token
    const user = await AuthService.verifyAccessToken(token);
    
    // Add user data to request object
    req.user = user;
    req.isAuthenticated = true;

    next();

  } catch (error) {
    // For optional auth, invalid tokens are treated as no authentication
    // This prevents breaking requests when tokens are expired or invalid
    req.user = null;
    req.isAuthenticated = false;
    next();
  }
};

/**
 * Refresh token validation middleware
 * Used for token refresh endpoints to validate refresh tokens from cookies
 */
export const validateRefreshToken = async (req, res, next) => {
  try {
    // Extract refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Refresh token not found in cookies',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    const tokenData = await AuthService.verifyRefreshToken(refreshToken);
    
    // Add token data to request
    req.refreshTokenData = tokenData;
    req.refreshToken = refreshToken;

    next();

  } catch (error) {
    // Clear invalid refresh token cookie
    res.clearCookie('refreshToken', AuthService.getClearRefreshTokenCookieOptions());

    if (error.message === 'Refresh token expired') {
      return res.status(401).json({
        error: 'Refresh token expired',
        message: 'Please log in again',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    if (error.message === 'Invalid refresh token') {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Please log in again',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (error.message === 'User not found') {
      return res.status(401).json({
        error: 'User not found',
        message: 'User associated with refresh token no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(401).json({
      error: 'Refresh token validation failed',
      message: 'Please log in again',
      code: 'REFRESH_TOKEN_INVALID'
    });
  }
};

/**
 * Rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register endpoints
 */
export const authRateLimit = (windowMs = 15 * 60 * 1000, maxAttempts = 5) => {
  const attempts = new Map();

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize attempts for this IP
    let clientAttempts = attempts.get(clientIP) || [];
    
    // Remove old attempts outside the window
    clientAttempts = clientAttempts.filter(attemptTime => attemptTime > windowStart);
    
    // Check if rate limit exceeded
    if (clientAttempts.length >= maxAttempts) {
      return res.status(429).json({
        error: 'Too many attempts',
        message: `Too many authentication attempts. Try again in ${Math.ceil(windowMs / 60000)} minutes.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current attempt
    clientAttempts.push(now);
    attempts.set(clientIP, clientAttempts);

    // Clean up old entries periodically (every 100 requests)
    if (Math.random() < 0.01) {
      for (const [ip, ipAttempts] of attempts.entries()) {
        const validAttempts = ipAttempts.filter(attemptTime => attemptTime > windowStart);
        if (validAttempts.length === 0) {
          attempts.delete(ip);
        } else {
          attempts.set(ip, validAttempts);
        }
      }
    }

    next();
  };
};

/**
 * Extract user ID from token for route parameters
 * Middleware that adds authenticated user's ID to req.params.userId if not present
 * Useful for routes like /api/users/me that should use the authenticated user's ID
 */
export const extractUserIdFromToken = (req, res, next) => {
  if (req.user && req.user.id && !req.params.userId) {
    req.params.userId = req.user.id.toString();
  }
  next();
};

/**
 * Validate request format for authentication endpoints
 * Ensures required fields are present and properly formatted
 */
export const validateAuthRequest = (requiredFields = []) => {
  return (req, res, next) => {
    const errors = [];

    // Check for JSON content type
    if (req.headers['content-type'] !== 'application/json') {
      return res.status(400).json({
        error: 'Invalid content type',
        message: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }

    // Check required fields
    for (const field of requiredFields) {
      if (!req.body || req.body[field] === undefined || req.body[field] === null) {
        errors.push(`${field} is required`);
      } else if (typeof req.body[field] === 'string' && req.body[field].trim() === '') {
        errors.push(`${field} cannot be empty`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Required fields are missing or invalid',
        errors,
        code: 'VALIDATION_FAILED'
      });
    }

    next();
  };
};

/**
 * Security headers middleware for auth endpoints
 * Adds security headers to authentication-related responses
 */
export const authSecurityHeaders = (req, res, next) => {
  // Prevent caching of authentication responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  next();
};

/**
 * CORS middleware for authentication endpoints
 * Handles cross-origin requests for auth endpoints with credentials
 */
export const authCors = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',  // Development frontend
    'http://localhost:5173',  // Vite dev server
    process.env.FRONTEND_URL  // Production frontend
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};

/**
 * Error handler for authentication middleware
 * Centralized error handling for auth-related errors
 */
export const authErrorHandler = (error, req, res, next) => {
  console.error('Authentication error:', error);

  // Handle specific error types
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid',
      code: 'INVALID_JWT'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'The provided token has expired',
      code: 'JWT_EXPIRED'
    });
  }

  // Generic error response
  res.status(500).json({
    error: 'Authentication error',
    message: 'An error occurred during authentication',
    code: 'AUTH_ERROR'
  });
};

export default {
  requireAuth,
  optionalAuth,
  validateRefreshToken,
  authRateLimit,
  extractUserIdFromToken,
  validateAuthRequest,
  authSecurityHeaders,
  authCors,
  authErrorHandler
};