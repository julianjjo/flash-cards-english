import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from '@jest/globals';
import UserProfile from './UserProfile';

// Mock auth context
const mockUpdateProfile = vi.fn();
const mockDeleteAccount = vi.fn();
const mockAuth = {
  loading: false,
  error: null,
  isAuthenticated: true,
  user: {
    id: 1,
    email: 'test@example.com',
    role: 'user',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  updateProfile: mockUpdateProfile,
  deleteAccount: mockDeleteAccount
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth
}));

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn())
}));

describe('UserProfile Component Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.loading = false;
    mockAuth.error = null;
    mockAuth.user = {
      id: 1,
      email: 'test@example.com',
      role: 'user',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    };
  });

  test('should render user profile information', () => {
    expect(() => {
      render(<UserProfile />);
    }).not.toThrow(); // This MUST fail initially - UserProfile doesn't exist

    // Verify user information is displayed
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/user/i)).toBeInTheDocument(); // Role
    expect(screen.getByText(/january 1, 2025/i)).toBeInTheDocument(); // Created date
  });

  test('should allow editing email address', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });

    render(<UserProfile />);

    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save|update/i });

    // Edit email
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@example.com');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        email: 'newemail@example.com'
      });
    });
  });

  test('should validate email format', async () => {
    render(<UserProfile />);

    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save|update/i });

    // Enter invalid email
    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email');
    await user.click(saveButton);

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test('should handle password change', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });

    render(<UserProfile />);

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    // Password change form should appear
    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm.*password/i);
    const updatePasswordButton = screen.getByRole('button', { name: /update password/i });

    await user.type(currentPasswordInput, 'currentPassword123');
    await user.type(newPasswordInput, 'newPassword456');
    await user.type(confirmPasswordInput, 'newPassword456');
    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        currentPassword: 'currentPassword123',
        newPassword: 'newPassword456'
      });
    });
  });

  test('should validate password confirmation', async () => {
    render(<UserProfile />);

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm.*password/i);
    const updatePasswordButton = screen.getByRole('button', { name: /update password/i });

    await user.type(newPasswordInput, 'newPassword456');
    await user.type(confirmPasswordInput, 'differentPassword');
    await user.click(updatePasswordButton);

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test('should validate new password length', async () => {
    render(<UserProfile />);

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    const newPasswordInput = screen.getByLabelText(/new password/i);
    const updatePasswordButton = screen.getByRole('button', { name: /update password/i });

    await user.type(newPasswordInput, '123'); // Too short
    await user.click(updatePasswordButton);

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test('should display loading state during profile update', async () => {
    mockAuth.loading = true;
    mockUpdateProfile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<UserProfile />);

    const saveButton = screen.getByRole('button', { name: /saving|save|updating|update/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/saving|updating/i)).toBeInTheDocument();
  });

  test('should display error messages', async () => {
    mockAuth.error = 'Update failed';

    render(<UserProfile />);

    expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('should handle account deletion', async () => {
    mockDeleteAccount.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true); // Mock confirmation dialog

    render(<UserProfile />);

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    // Confirmation dialog should appear
    const confirmPasswordInput = screen.getByLabelText(/confirm.*password/i);
    const confirmDeleteButton = screen.getByRole('button', { name: /confirm.*delete/i });

    await user.type(confirmPasswordInput, 'currentPassword123');
    await user.click(confirmDeleteButton);

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith('currentPassword123');
    });
  });

  test('should prevent accidental account deletion', async () => {
    render(<UserProfile />);

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    // Should require password confirmation
    const confirmDeleteButton = screen.getByRole('button', { name: /confirm.*delete/i });
    await user.click(confirmDeleteButton);

    expect(screen.getByText(/password.*required/i)).toBeInTheDocument();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  test('should cancel password change', async () => {
    render(<UserProfile />);

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    // Password form should be visible
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Password form should be hidden
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  test('should show success message after profile update', async () => {
    mockUpdateProfile.mockResolvedValue({ 
      success: true,
      message: 'Profile updated successfully' 
    });

    render(<UserProfile />);

    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save|update/i });

    await user.clear(emailInput);
    await user.type(emailInput, 'updated@example.com');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
    });
  });

  test('should display user role badge', () => {
    render(<UserProfile />);

    const roleBadge = screen.getByText(/user/i);
    expect(roleBadge).toHaveClass(/badge|chip|tag/); // Should have badge styling
  });

  test('should show admin role differently', () => {
    mockAuth.user.role = 'admin';

    render(<UserProfile />);

    const adminBadge = screen.getByText(/admin/i);
    expect(adminBadge).toBeInTheDocument();
    expect(adminBadge).toHaveClass(/admin|elevated/); // Admin-specific styling
  });

  test('should format dates properly', () => {
    render(<UserProfile />);

    // Should display formatted creation date
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
    expect(screen.getByText(/january 1, 2025/i)).toBeInTheDocument();
  });

  test('should handle network errors gracefully', async () => {
    mockUpdateProfile.mockRejectedValue({
      success: false,
      message: 'Network error'
    });

    render(<UserProfile />);

    const emailInput = screen.getByLabelText(/email/i);
    const saveButton = screen.getByRole('button', { name: /save|update/i });

    await user.clear(emailInput);
    await user.type(emailInput, 'test@example.com');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  test('should have proper accessibility attributes', () => {
    render(<UserProfile />);

    const emailInput = screen.getByLabelText(/email/i);
    const form = screen.getByRole('form') || screen.getByTestId('profile-form');

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(form).toHaveAttribute('noValidate');

    // Error messages should have proper ARIA attributes
    mockAuth.error = 'Test error';
    render(<UserProfile />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
  });
});