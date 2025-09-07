import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_ISSUER = 'flash-cards-app';
const JWT_AUDIENCE = 'flash-cards-users';

export const generateToken = (user) => {
  if (!user || !user.id || !user.email || !user.role) {
    throw new Error('Invalid user data for token generation');
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000) // Issued at time
  };

  const options = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    subject: user.id.toString()
  };

  try {
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (error) {
    throw new Error('Failed to generate JWT token');
  }
};

export const verifyToken = (token) => {
  if (!token) {
    throw new Error('Token is required');
  }

  const options = {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  };

  try {
    const decoded = jwt.verify(token, JWT_SECRET, options);
    
    // Validate required payload fields
    if (!decoded.id || !decoded.email || !decoded.role) {
      throw new Error('Invalid token payload');
    }

    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token not active');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

export const decodeToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    // Decode without verification (for debugging purposes only)
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

export const isTokenExpired = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

export const getTokenExpiration = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
};

export const refreshToken = (oldToken) => {
  try {
    const decoded = verifyToken(oldToken);
    
    // Create new token with same user data but fresh expiration
    const user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    return generateToken(user);
  } catch (error) {
    throw new Error('Cannot refresh invalid token');
  }
};