import express from 'express';
import AuthService from '../services/AuthService.js';
import UserService from '../services/UserService.js';
import { 
  requireAuth, 
  validateRefreshToken, 
  authRateLimit, 
  validateAuthRequest, 
  authSecurityHeaders, 
  authCors, 
  authErrorHandler 
} from '../middleware/auth.js';

const router = express.Router();

// Apply common middleware to all auth routes
router.use(authCors);
router.use(authSecurityHeaders);

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', 
  authRateLimit(15 * 60 * 1000, 5), // 5 attempts per 15 minutes
  validateAuthRequest(['email', 'password']),
  async (req, res) => {
    try {
      const { email, password, role = 'user' } = req.body;

      // Validate input
      const validation = UserService.validateRegistration({ email, password, role });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Registration data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      // Register user and get tokens
      const authResponse = await AuthService.register({ email, password, role });

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', authResponse.refreshToken, AuthService.getRefreshTokenCookieOptions());

      // Return user data and access token
      res.status(201).json({
        message: 'Registration successful',
        user: authResponse.user,
        accessToken: authResponse.accessToken,
        tokenType: 'Bearer'
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already registered') || error.message.includes('already taken')) {
        return res.status(409).json({
          error: 'Email already registered',
          message: 'An account with this email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      res.status(500).json({
        error: 'Registration failed',
        message: 'An error occurred during registration',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login',
  authRateLimit(15 * 60 * 1000, 10), // 10 attempts per 15 minutes
  validateAuthRequest(['email', 'password']),
  async (req, res) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // Validate credentials format
      const validation = AuthService.validateLoginCredentials({ email, password });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Login credentials are invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      // Authenticate user
      const authResponse = await AuthService.login(email, password);

      // Set refresh token in httpOnly cookie
      const cookieOptions = AuthService.getRefreshTokenCookieOptions();
      if (rememberMe) {
        // Extend cookie expiry for "remember me"
        cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      res.cookie('refreshToken', authResponse.refreshToken, cookieOptions);

      // Return user data and access token
      res.json({
        message: 'Login successful',
        user: authResponse.user,
        accessToken: authResponse.accessToken,
        tokenType: 'Bearer'
      });

    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
          code: 'INVALID_CREDENTIALS'
        });
      }

      res.status(500).json({
        error: 'Login failed',
        message: 'An error occurred during login',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  validateRefreshToken,
  async (req, res) => {
    try {
      // Refresh access token
      const tokenResponse = await AuthService.refreshAccessToken(req.refreshToken);

      res.json({
        message: 'Token refreshed successfully',
        user: tokenResponse.user,
        accessToken: tokenResponse.accessToken,
        tokenType: 'Bearer'
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken', AuthService.getClearRefreshTokenCookieOptions());

      res.status(401).json({
        error: 'Token refresh failed',
        message: 'Please log in again',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user and clear refresh token
 */
router.post('/logout', async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken', AuthService.getClearRefreshTokenCookieOptions());

    // Call logout service (mainly for logging purposes)
    await AuthService.logout();

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if service fails, clear the cookie and return success
    res.clearCookie('refreshToken', AuthService.getClearRefreshTokenCookieOptions());
    
    res.json({
      message: 'Logout successful'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile from token
 */
router.get('/me',
  requireAuth,
  async (req, res) => {
    try {
      // Get detailed user profile
      const userProfile = await UserService.getProfile(req.user.id, req.user.id, req.user.role);

      res.json({
        user: userProfile
      });

    } catch (error) {
      console.error('Get current user error:', error);
      
      res.status(500).json({
        error: 'Failed to get user profile',
        message: 'An error occurred while fetching user data',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password',
  requireAuth,
  validateAuthRequest(['currentPassword', 'newPassword']),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validate password change data
      const validation = AuthService.validatePasswordChangeRequest({ currentPassword, newPassword });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Password change data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      // Change password
      await AuthService.changePassword(req.user.email, currentPassword, newPassword);

      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Password change error:', error);
      
      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Incorrect password',
          message: 'Current password is incorrect',
          code: 'CURRENT_PASSWORD_INCORRECT'
        });
      }

      if (error.message.includes('Password must be at least')) {
        return res.status(400).json({
          error: 'Invalid password',
          message: error.message,
          code: 'INVALID_NEW_PASSWORD'
        });
      }

      res.status(500).json({
        error: 'Password change failed',
        message: 'An error occurred while changing password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/verify-token
 * Verify if access token is valid
 */
router.post('/verify-token',
  requireAuth,
  async (req, res) => {
    try {
      // If we get here, token is valid (middleware verified it)
      const tokenExpiry = AuthService.getTokenExpiry(req.headers.authorization?.split(' ')[1]);

      res.json({
        valid: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        },
        tokenExpiry: tokenExpiry
      });

    } catch (error) {
      console.error('Token verification error:', error);
      
      res.status(401).json({
        valid: false,
        error: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  }
);

/**
 * GET /api/auth/session-info
 * Get current session information
 */
router.get('/session-info',
  requireAuth,
  async (req, res) => {
    try {
      const accessToken = AuthService.extractTokenFromHeader(req.headers.authorization);
      const tokenExpiry = AuthService.getTokenExpiry(accessToken);
      const hasRefreshToken = !!req.cookies?.refreshToken;

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        },
        session: {
          accessToken: {
            expiresAt: tokenExpiry?.expiresAt,
            expiresIn: tokenExpiry?.expiresIn,
            isExpired: tokenExpiry?.isExpired
          },
          refreshToken: {
            available: hasRefreshToken
          }
        }
      });

    } catch (error) {
      console.error('Session info error:', error);
      
      res.status(500).json({
        error: 'Failed to get session info',
        message: 'An error occurred while fetching session information',
        code: 'SESSION_INFO_ERROR'
      });
    }
  }
);

// Apply error handler middleware
router.use(authErrorHandler);

export default router;