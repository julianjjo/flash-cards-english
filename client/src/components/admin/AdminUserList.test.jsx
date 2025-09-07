import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from '@jest/globals';
import AdminUserList from './AdminUserList';

// Mock auth context
const mockGetAllUsers = vi.fn();
const mockUpdateUserRole = vi.fn();
const mockDeleteUser = vi.fn();
const mockAuth = {
  loading: false,
  error: null,
  isAuthenticated: true,
  user: {
    id: 1,
    email: 'admin@example.com',
    role: 'admin'
  },
  getAllUsers: mockGetAllUsers,
  updateUserRole: mockUpdateUserRole,
  deleteUser: mockDeleteUser
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth
}));

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
}));

const mockUsers = [
  {
    id: 1,
    email: 'admin@example.com',
    role: 'admin',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    last_login: '2025-01-07T10:00:00.000Z'
  },
  {
    id: 2,
    email: 'user1@example.com',
    role: 'user',
    created_at: '2025-01-02T00:00:00.000Z',
    updated_at: '2025-01-02T00:00:00.000Z',
    last_login: '2025-01-06T15:30:00.000Z'
  },
  {
    id: 3,
    email: 'user2@example.com',
    role: 'user',
    created_at: '2025-01-03T00:00:00.000Z',
    updated_at: '2025-01-03T00:00:00.000Z',
    last_login: null
  }
];

const mockPagination = {
  page: 1,
  limit: 10,
  total: 3,
  totalPages: 1
};

describe('AdminUserList Component Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.loading = false;
    mockAuth.error = null;
    mockGetAllUsers.mockResolvedValue({
      success: true,
      users: mockUsers,
      pagination: mockPagination
    });
  });

  test('should render user list table', async () => {
    expect(() => {
      render(<AdminUserList />);
    }).not.toThrow(); // This MUST fail initially - AdminUserList doesn't exist

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Verify table headers
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/role/i)).toBeInTheDocument();
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/last login/i)).toBeInTheDocument();
    expect(screen.getByText(/actions/i)).toBeInTheDocument();

    // Verify user data is displayed
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
  });

  test('should load users on component mount', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      expect(mockGetAllUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: ''
      });
    });
  });

  test('should display loading state', () => {
    mockAuth.loading = true;

    render(<AdminUserList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('should display error state', () => {
    mockAuth.error = 'Failed to load users';

    render(<AdminUserList />);

    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('should handle search functionality', async () => {
    render(<AdminUserList />);

    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'user1');

    // Should debounce search and call API
    await waitFor(() => {
      expect(mockGetAllUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'user1'
      });
    }, { timeout: 1000 });
  });

  test('should handle pagination', async () => {
    const multiPagePagination = {
      page: 1,
      limit: 2,
      total: 10,
      totalPages: 5
    };

    mockGetAllUsers.mockResolvedValue({
      success: true,
      users: mockUsers.slice(0, 2),
      pagination: multiPagePagination
    });

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(mockGetAllUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 2,
      search: ''
    });
  });

  test('should promote user to admin', async () => {
    mockUpdateUserRole.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const promoteButtons = screen.getAllByRole('button', { name: /promote/i });
    await user.click(promoteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('promote')
    );

    await waitFor(() => {
      expect(mockUpdateUserRole).toHaveBeenCalledWith(2, 'admin');
    });
  });

  test('should demote admin to user', async () => {
    mockUpdateUserRole.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });

    const demoteButtons = screen.getAllByRole('button', { name: /demote/i });
    await user.click(demoteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('demote')
    );

    await waitFor(() => {
      expect(mockUpdateUserRole).toHaveBeenCalledWith(1, 'user');
    });
  });

  test('should delete user account', async () => {
    mockDeleteUser.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('delete')
    );

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith(2);
    });
  });

  test('should prevent self-deletion', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });

    // Find the delete button for the current admin user (should be disabled)
    const adminRow = screen.getByText('admin@example.com').closest('tr');
    const deleteButton = adminRow.querySelector('button[aria-label*="delete"], button:contains("Delete")');
    
    if (deleteButton) {
      expect(deleteButton).toBeDisabled();
    } else {
      // Delete button should not exist for current user
      expect(adminRow.textContent).not.toContain('Delete');
    }
  });

  test('should cancel action on confirmation dialog', async () => {
    window.confirm = vi.fn(() => false); // User cancels

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test('should refresh user list after actions', async () => {
    mockUpdateUserRole.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<AdminUserList />);

    await waitFor(() => {
      expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
    });

    const promoteButtons = screen.getAllByRole('button', { name: /promote/i });
    await user.click(promoteButtons[0]);

    await waitFor(() => {
      expect(mockGetAllUsers).toHaveBeenCalledTimes(2); // Initial load + refresh after action
    });
  });

  test('should display user roles with appropriate styling', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      const adminBadge = screen.getByText(/admin/i);
      const userBadges = screen.getAllByText(/^user$/i);

      expect(adminBadge).toHaveClass(/admin|elevated/); // Admin-specific styling
      expect(userBadges[0]).toHaveClass(/user|default/); // User styling
    });
  });

  test('should format dates properly', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText(/jan.*1.*2025/i)).toBeInTheDocument(); // Created date
      expect(screen.getByText(/jan.*7.*2025/i)).toBeInTheDocument(); // Last login
      expect(screen.getByText(/never/i)).toBeInTheDocument(); // Never logged in
    });
  });

  test('should handle empty user list', async () => {
    mockGetAllUsers.mockResolvedValue({
      success: true,
      users: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
    });

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });

  test('should handle API errors gracefully', async () => {
    mockUpdateUserRole.mockRejectedValue({
      success: false,
      message: 'Update failed'
    });
    window.confirm = vi.fn(() => true);

    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const promoteButtons = screen.getAllByRole('button', { name: /promote/i });
    await user.click(promoteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });
  });

  test('should have proper accessibility attributes', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      const table = screen.getByRole('table');
      const searchInput = screen.getByRole('searchbox');

      expect(table).toHaveAttribute('aria-label', expect.stringContaining('users'));
      expect(searchInput).toHaveAttribute('placeholder');
      
      // Action buttons should have descriptive labels
      const actionButtons = screen.getAllByRole('button');
      actionButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  test('should support keyboard navigation', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('searchbox');
    const firstButton = screen.getAllByRole('button')[0];

    // Tab navigation should work
    searchInput.focus();
    expect(searchInput).toHaveFocus();

    await user.tab();
    expect(firstButton).toHaveFocus();
  });

  test('should display user statistics', async () => {
    render(<AdminUserList />);

    await waitFor(() => {
      expect(screen.getByText(/3 users/i)).toBeInTheDocument(); // Total count
      expect(screen.getByText(/1 admin/i)).toBeInTheDocument(); // Admin count
      expect(screen.getByText(/2 users/i)).toBeInTheDocument(); // Regular user count
    });
  });
});