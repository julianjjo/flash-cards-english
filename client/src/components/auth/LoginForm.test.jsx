import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from '@jest/globals';
import LoginForm from './LoginForm';

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
}));

// Mock auth context
const mockLogin = vi.fn();
const mockAuth = {
  loading: false,
  error: null,
  isAuthenticated: false,
  user: null,
  login: mockLogin
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth
}));

describe('LoginForm Component Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.loading = false;
    mockAuth.error = null;
    mockAuth.isAuthenticated = false;
  });

  test('should render login form with required fields', () => {
    expect(() => {
      render(<LoginForm />);
    }).not.toThrow(); // This MUST fail initially - LoginForm doesn't exist

    // Verify form elements are present
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/register/i)).toBeInTheDocument(); // Link to register
  });

  test('should validate email field', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

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
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    // Test empty password
    await user.click(submitButton);
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();

    // Test valid password
    await user.type(passwordInput, 'TestPassword123');
    
    // Password validation error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument();
    });
  });

  test('should submit form with valid data', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123'
      });
    });
  });

  test('should display loading state during submission', async () => {
    mockAuth.loading = true;
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /logging in|login/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/logging in|loading/i)).toBeInTheDocument();
  });

  test('should display error message on login failure', async () => {
    mockAuth.error = 'Invalid credentials';

    render(<LoginForm />);

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('should clear form after successful submission', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });
  });

  test('should prevent multiple submissions', async () => {
    mockAuth.loading = true;
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /logging in|login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    
    // Try to click multiple times
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Should only be called once
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  test('should show/hide password functionality', async () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: /show|hide password/i });

    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password again
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should handle keyboard navigation', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    // Tab navigation should work
    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  test('should submit form on Enter key press', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');
    
    // Press Enter in password field
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123'
      });
    });
  });

  test('should have proper accessibility attributes', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const form = screen.getByRole('form') || screen.getByTestId('login-form');

    // Form should have proper ARIA attributes
    expect(form).toHaveAttribute('noValidate');
    
    // Inputs should have proper attributes
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(emailInput).toHaveAttribute('required');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    expect(passwordInput).toHaveAttribute('required');
  });

  test('should link to registration page', () => {
    render(<LoginForm />);

    const registerLink = screen.getByText(/register/i);
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('should handle form reset', async () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Fill form
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TestPassword123');

    // Clear form (could be via a reset button or programmatically)
    fireEvent.reset(emailInput.form);

    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
  });
});