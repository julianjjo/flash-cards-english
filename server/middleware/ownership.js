import FlashcardService from '../services/FlashcardService.js';
import UserService from '../services/UserService.js';
import AuthService from '../services/AuthService.js';

/**
 * Resource Ownership Middleware
 * 
 * Handles access control for user-owned resources (flashcards, user data).
 * Ensures users can only access their own resources unless they have admin privileges.
 * Provides flexible ownership validation for different resource types.
 */

/**
 * Validate flashcard ownership
 * Middleware that checks if the authenticated user owns the requested flashcard
 * or has admin privileges to access any flashcard
 */
export const validateFlashcardOwnership = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access flashcards',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get flashcard ID from route parameters
    const flashcardId = req.params.flashcardId || req.params.id;
    
    if (!flashcardId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Flashcard ID parameter is required',
        code: 'FLASHCARD_ID_REQUIRED'
      });
    }

    // Validate flashcard ID format
    if (!Number.isInteger(Number(flashcardId))) {
      return res.status(400).json({
        error: 'Invalid flashcard ID',
        message: 'Flashcard ID must be a valid number',
        code: 'INVALID_FLASHCARD_ID'
      });
    }

    // Admin users can access any flashcard
    if (AuthService.isAdmin(req.user)) {
      req.flashcardAccess = {
        isOwner: false,
        isAdmin: true,
        flashcardId: Number(flashcardId)
      };
      return next();
    }

    // Check if user owns the flashcard
    const hasAccess = await FlashcardService.canUserAccessFlashcard(flashcardId, req.user.id);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this flashcard',
        code: 'FLASHCARD_ACCESS_DENIED'
      });
    }

    // User owns the flashcard
    req.flashcardAccess = {
      isOwner: true,
      isAdmin: false,
      flashcardId: Number(flashcardId)
    };

    next();

  } catch (error) {
    console.error('Flashcard ownership validation error:', error);
    
    if (error.message === 'Valid user ID is required' || 
        error.message === 'Valid flashcard ID is required') {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'Invalid flashcard or user ID',
        code: 'INVALID_PARAMETERS'
      });
    }

    res.status(500).json({
      error: 'Ownership validation error',
      message: 'An error occurred while validating flashcard ownership',
      code: 'OWNERSHIP_VALIDATION_ERROR'
    });
  }
};

/**
 * Validate user resource ownership
 * Middleware that checks if the authenticated user can access user-specific resources
 * Allows access to own resources or admin access to any user's resources
 */
export const validateUserResourceOwnership = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access user resources',
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

    // Validate user ID format
    if (!Number.isInteger(Number(targetUserId))) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number',
        code: 'INVALID_USER_ID'
      });
    }

    // Check if target user exists
    const targetUserExists = await UserService.userExists(targetUserId);
    if (!targetUserExists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist',
        code: 'USER_NOT_FOUND'
      });
    }

    // Admin users can access any user's resources
    if (AuthService.isAdmin(req.user)) {
      req.userResourceAccess = {
        isOwner: Number(req.user.id) === Number(targetUserId),
        isAdmin: true,
        targetUserId: Number(targetUserId)
      };
      return next();
    }

    // Check if user is accessing their own resources
    if (!AuthService.canAccessUserResource(req.user, targetUserId)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources',
        code: 'USER_RESOURCE_ACCESS_DENIED'
      });
    }

    // User is accessing their own resources
    req.userResourceAccess = {
      isOwner: true,
      isAdmin: false,
      targetUserId: Number(targetUserId)
    };

    next();

  } catch (error) {
    console.error('User resource ownership validation error:', error);
    
    res.status(500).json({
      error: 'Ownership validation error',
      message: 'An error occurred while validating user resource ownership',
      code: 'OWNERSHIP_VALIDATION_ERROR'
    });
  }
};

/**
 * Optional ownership validation
 * Middleware that validates ownership but doesn't block access if validation fails
 * Useful for endpoints that provide different responses based on ownership
 */
export const optionalOwnershipValidation = (resourceType = 'flashcard') => {
  return async (req, res, next) => {
    try {
      // Set default access values
      req.resourceAccess = {
        isOwner: false,
        isAdmin: false,
        hasAccess: false
      };

      // Skip if not authenticated
      if (!req.user || !req.isAuthenticated) {
        return next();
      }

      const resourceId = req.params[`${resourceType}Id`] || req.params.id;
      
      if (!resourceId) {
        return next();
      }

      // Check admin status
      if (AuthService.isAdmin(req.user)) {
        req.resourceAccess = {
          isOwner: false,
          isAdmin: true,
          hasAccess: true,
          resourceId: Number(resourceId)
        };
        return next();
      }

      // Check ownership based on resource type
      let hasAccess = false;
      
      if (resourceType === 'flashcard') {
        hasAccess = await FlashcardService.canUserAccessFlashcard(resourceId, req.user.id);
      } else if (resourceType === 'user') {
        hasAccess = AuthService.canAccessUserResource(req.user, resourceId);
      }

      req.resourceAccess = {
        isOwner: hasAccess,
        isAdmin: false,
        hasAccess,
        resourceId: Number(resourceId)
      };

      next();

    } catch (error) {
      // For optional validation, errors don't block the request
      console.error('Optional ownership validation error:', error);
      req.resourceAccess = {
        isOwner: false,
        isAdmin: false,
        hasAccess: false
      };
      next();
    }
  };
};

/**
 * Bulk ownership validation
 * Middleware for operations that affect multiple resources at once
 * Validates that user owns all resources in the request
 */
export const validateBulkOwnership = (resourceType = 'flashcard') => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.isAuthenticated) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to perform bulk operations',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admin users can perform bulk operations on any resources
      if (AuthService.isAdmin(req.user)) {
        req.bulkAccess = {
          isAdmin: true,
          hasFullAccess: true
        };
        return next();
      }

      // Get resource IDs from request body
      const resourceIds = req.body.ids || req.body[`${resourceType}Ids`] || [];
      
      if (!Array.isArray(resourceIds)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Resource IDs must be provided as an array',
          code: 'INVALID_BULK_REQUEST'
        });
      }

      if (resourceIds.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'At least one resource ID is required',
          code: 'EMPTY_BULK_REQUEST'
        });
      }

      if (resourceIds.length > 100) {
        return res.status(400).json({
          error: 'Request too large',
          message: 'Cannot process more than 100 resources at once',
          code: 'BULK_LIMIT_EXCEEDED'
        });
      }

      // Validate each resource ID format
      const invalidIds = resourceIds.filter(id => !Number.isInteger(Number(id)));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid resource IDs',
          message: 'All resource IDs must be valid numbers',
          code: 'INVALID_RESOURCE_IDS',
          invalidIds
        });
      }

      // Check ownership of all resources
      const accessPromises = resourceIds.map(async (resourceId) => {
        if (resourceType === 'flashcard') {
          return {
            id: resourceId,
            hasAccess: await FlashcardService.canUserAccessFlashcard(resourceId, req.user.id)
          };
        }
        // Add other resource types as needed
        return { id: resourceId, hasAccess: false };
      });

      const accessResults = await Promise.all(accessPromises);
      const deniedAccess = accessResults.filter(result => !result.hasAccess);

      if (deniedAccess.length > 0) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access some of the requested resources',
          code: 'BULK_ACCESS_DENIED',
          deniedResourceIds: deniedAccess.map(result => result.id)
        });
      }

      // All resources are accessible
      req.bulkAccess = {
        isAdmin: false,
        hasFullAccess: true,
        resourceIds: resourceIds.map(Number),
        resourceType
      };

      next();

    } catch (error) {
      console.error('Bulk ownership validation error:', error);
      
      res.status(500).json({
        error: 'Ownership validation error',
        message: 'An error occurred while validating bulk resource ownership',
        code: 'BULK_OWNERSHIP_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Resource creation ownership
 * Middleware that ensures users can only create resources for themselves
 * unless they have admin privileges
 */
export const validateResourceCreation = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to create resources',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin users can create resources for any user
    if (AuthService.isAdmin(req.user)) {
      req.creationAccess = {
        isAdmin: true,
        canCreateForAnyUser: true
      };
      return next();
    }

    // Regular users can only create resources for themselves
    // If userId is specified in the request body, it must match the authenticated user
    if (req.body.userId && Number(req.body.userId) !== Number(req.user.id)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only create resources for yourself',
        code: 'CREATION_ACCESS_DENIED'
      });
    }

    // Set userId to authenticated user if not specified
    if (!req.body.userId) {
      req.body.userId = req.user.id;
    }

    req.creationAccess = {
      isAdmin: false,
      canCreateForAnyUser: false,
      userId: req.user.id
    };

    next();

  } catch (error) {
    console.error('Resource creation validation error:', error);
    
    res.status(500).json({
      error: 'Creation validation error',
      message: 'An error occurred while validating resource creation',
      code: 'CREATION_VALIDATION_ERROR'
    });
  }
};

export default {
  validateFlashcardOwnership,
  validateUserResourceOwnership,
  optionalOwnershipValidation,
  validateBulkOwnership,
  validateResourceCreation
};