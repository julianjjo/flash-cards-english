import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // Higher than default for better security

export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error('Failed to hash password');
  }
};

export const verifyPassword = async (password, hashedPassword) => {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error('Failed to verify password');
  }
};

export const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for at least one uppercase letter or number
  if (!/[A-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter or number');
  }

  // Check for common weak passwords
  const weakPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'login', 'welcome', 'guest'
  ];
  
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common - please choose a more secure password');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};