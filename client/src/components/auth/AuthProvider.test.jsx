import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from '@jest/globals';
import AuthProvider from './AuthProvider';
import { useAuth } from '../../hooks/useAuth';

// Mock the auth service
vi.mock('../../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getUserFromToken: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
    getAllUsers: vi.fn(),
    updateUserRole: vi.fn(),
    deleteUser: vi.fn()
  }
}));

// Test component to consume auth context
const TestComponent = () => {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{auth.isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{auth.user ? auth.user.email : 'no-user'}</div>
      <div data-testid="error">{auth.error || 'no-error'}</div>
      <button onClick={() => auth.login({ email: 'test@example.com', password: 'password' })}>
        Login
      </button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('AuthProvider Component Tests', () => {
  let mockAuthService;

  beforeEach(async () => {
    // This test MUST fail until AuthProvider component is implemented
    const authServiceModule = await import('../../services/authService');
    mockAuthService = authServiceModule.default;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up localStorage
    localStorage.clear();
  });

  test('should provide authentication context to child components', async () => {
    expect(() => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    }).not.toThrow(); // This MUST fail initially - AuthProvider doesn't exist

    // Verify context values are accessible
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByTestId('authenticated')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toBeInTheDocument();
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });

  test('should initialize with loading state', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getUserFromToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should start in loading state
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  test('should load authenticated user on mount', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };

    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getUserFromToken.mockReturnValue(mockUser);
    mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
  });

  test('should handle login successfully', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };

    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.login.mockResolvedValue({
      success: true,
      user: mockUser,
      token: 'mock-token'
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
    });
  });

  test('should handle login failure', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.login.mockRejectedValue({
      success: false,
      message: 'Invalid credentials'
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    });
  });

  test('should handle logout successfully', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };

    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getUserFromToken.mockReturnValue(mockUser);
    mockAuthService.logout.mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const logoutButton = screen.getByText('Logout');
    
    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  test('should handle token expiration', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getUserFromToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate auth:logout event
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  test('should throw error when useAuth is used outside AuthProvider', () => {
    const TestComponentOutsideProvider = () => {
      const auth = useAuth();
      return <div>{auth.loading ? 'loading' : 'not-loading'}</div>;
    };

    expect(() => {
      render(<TestComponentOutsideProvider />);
    }).toThrow('useAuth must be used within AuthProvider');
  });

  test('should clear error state on successful operations', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };

    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.login
      .mockRejectedValueOnce({ success: false, message: 'Invalid credentials' })
      .mockResolvedValueOnce({ success: true, user: mockUser, token: 'mock-token' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    
    // First login attempt fails
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });

    // Second login attempt succeeds
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });
  });

  test('should provide admin-related methods', async () => {
    const TestAdminComponent = () => {
      const auth = useAuth();
      
      return (
        <div>
          <button onClick={() => auth.getAllUsers()}>Get All Users</button>
          <button onClick={() => auth.updateUserRole(1, 'admin')}>Update Role</button>
          <button onClick={() => auth.deleteUser(1)}>Delete User</button>
        </div>
      );
    };

    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getAllUsers.mockResolvedValue({ users: [], pagination: {} });
    mockAuthService.updateUserRole.mockResolvedValue({ success: true });
    mockAuthService.deleteUser.mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <TestAdminComponent />
      </AuthProvider>
    );

    const getAllUsersButton = screen.getByText('Get All Users');
    const updateRoleButton = screen.getByText('Update Role');
    const deleteUserButton = screen.getByText('Delete User');

    await act(async () => {
      getAllUsersButton.click();
    });

    await act(async () => {
      updateRoleButton.click();
    });

    await act(async () => {
      deleteUserButton.click();
    });

    expect(mockAuthService.getAllUsers).toHaveBeenCalled();
    expect(mockAuthService.updateUserRole).toHaveBeenCalledWith(1, 'admin');
    expect(mockAuthService.deleteUser).toHaveBeenCalledWith(1);
  });
});