import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from '@jest/globals';
import RegisterForm from './RegisterForm';

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
}));

// Mock auth context
const mockRegister = vi.fn();
const mockAuth = {
  loading: false,
  error: null,
  isAuthenticated: false,
  user: null,
  register: mockRegister
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth
}));

describe('RegisterForm Component Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.loading = false;
    mockAuth.error = null;
    mockAuth.isAuthenticated = false;
  });

  test('should render registration form with required fields', () => {
    expect(() => {
      render(<RegisterForm />);
    }).not.toThrow(); // This MUST fail initially - RegisterForm doesn't exist

    // Verify form elements are present
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register|sign up/i })).toBeInTheDocument();
    expect(screen.getByText(/login|sign in/i)).toBeInTheDocument(); // Link to login
  });

  test('should validate email field', async () => {
    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    // Test empty email
    await user.click(submitButton);
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();

    // Test invalid email format
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();

    // Test valid email
    await user.clear(emailInput);
    await user.type(emailInput, 'test@example.com');
    
    // Email validation error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument();
    });
  });

  test('should validate password field', async () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    // Test empty password
    await user.click(submitButton);
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();

    // Test password too short
    await user.type(passwordInput, '123');
    await user.click(submitButton);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

    // Test valid password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'TestPassword123');
    
    // Password validation error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
    });
  });

  test('should validate password confirmation', async () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'DifferentPassword');
    await user.click(submitButton);

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();

    // Test matching passwords
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, 'TestPassword123');
    
    // Password mismatch error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
    });
  });

  test('should submit form with valid data', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'TestPassword123');
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123'
      });
    });
  });

  test('should display loading state during submission', async () => {
    mockAuth.loading = true;
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<RegisterForm />);

    const submitButton = screen.getByRole('button', { name: /registering|register|signing up|sign up/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/registering|loading/i)).toBeInTheDocument();
  });

  test('should display error message on registration failure', async () => {
    mockAuth.error = 'Email already exists';

    render(<RegisterForm />);

    expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('should clear form after successful submission', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'TestPassword123');
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
    });
  });

  test('should prevent multiple submissions', async () => {
    mockAuth.loading = true;
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /registering|register|signing up|sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'TestPassword123');
    
    // Try to click multiple times
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Should only be called once
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });
  });

  test('should show/hide password functionality', async () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const toggleButtons = screen.getAllByRole('button', { name: /show|hide password/i });

    // Initially passwords should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Click to show passwords
    await user.click(toggleButtons[0]);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleButtons[1]);
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');

    // Click to hide passwords again
    await user.click(toggleButtons[0]);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should validate password strength', async () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^password/i);

    // Test weak passwords
    await user.type(passwordInput, 'password');
    expect(screen.getByText(/password strength/i)).toBeInTheDocument();

    // Test strong password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'TestPassword123!');
    expect(screen.getByText(/strong|good/i)).toBeInTheDocument();
  });

  test('should handle keyboard navigation', async () => {
    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    // Tab navigation should work
    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(confirmPasswordInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  test('should submit form on Enter key press', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'TestPassword123');
    
    // Press Enter in confirm password field
    fireEvent.keyDown(confirmPasswordInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123'
      });
    });
  });

  test('should have proper accessibility attributes', () => {
    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const form = screen.getByRole('form') || screen.getByTestId('register-form');

    // Form should have proper ARIA attributes
    expect(form).toHaveAttribute('noValidate');
    
    // Inputs should have proper attributes
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(emailInput).toHaveAttribute('required');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
    expect(passwordInput).toHaveAttribute('required');

    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
    expect(confirmPasswordInput).toHaveAttribute('required');
  });

  test('should link to login page', () => {
    render(<RegisterForm />);

    const loginLink = screen.getByText(/login|sign in/i);
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('should show terms of service and privacy policy links', () => {
    render(<RegisterForm />);

    expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
  });

  test('should require terms acceptance', async () => {
    render(<RegisterForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });
    const termsCheckbox = screen.getByLabelText(/terms|agree/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    await user.type(confirmPasswordInput, 'TestPassword123');

    // Try to submit without accepting terms
    await user.click(submitButton);
    expect(screen.getByText(/accept terms/i)).toBeInTheDocument();

    // Accept terms and submit
    await user.click(termsCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });
});