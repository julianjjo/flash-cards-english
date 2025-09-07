import { render, screen } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock React Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to, state, replace }) => {
      mockNavigate(to, { state, replace });
      return <div data-testid="navigate-component">Redirecting to {to}</div>;
    }
  };
});

// Mock auth context
const mockAuth = {
  loading: false,
  error: null,
  isAuthenticated: false,
  user: null
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuth
}));

// Test components
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const AdminComponent = () => <div data-testid="admin-content">Admin Content</div>;

describe('ProtectedRoute Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.loading = false;
    mockAuth.error = null;
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;
  });

  test('should render loading spinner when authentication is loading', () => {
    mockAuth.loading = true;

    expect(() => {
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
    }).not.toThrow(); // This MUST fail initially - ProtectedRoute doesn't exist

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  test('should redirect to login when user is not authenticated', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;

    render(
      <MemoryRouter initialEntries={['/protected-page']}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate-component')).toBeInTheDocument();
    expect(screen.getByText(/redirecting to \/login/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    
    // Verify navigation was called with correct parameters
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { from: expect.objectContaining({ pathname: '/protected-page' }) },
      replace: true
    });
  });

  test('should render children when user is authenticated', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'test@example.com', role: 'user' };

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('navigate-component')).not.toBeInTheDocument();
  });

  test('should allow access when user has required role', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'admin@example.com', role: 'admin' };

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="admin">
          <AdminComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });

  test('should redirect to unauthorized when user lacks required role', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'user@example.com', role: 'user' };

    render(
      <MemoryRouter initialEntries={['/admin-page']}>
        <ProtectedRoute requiredRole="admin">
          <AdminComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate-component')).toBeInTheDocument();
    expect(screen.getByText(/redirecting to \/unauthorized/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    
    expect(mockNavigate).toHaveBeenCalledWith('/unauthorized', { replace: true });
  });

  test('should handle multiple roles requirement', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'user@example.com', role: 'user' };

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRoles={['admin', 'user']}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('should redirect when user has none of the required roles', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'user@example.com', role: 'user' };

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRoles={['admin', 'moderator']}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate-component')).toBeInTheDocument();
    expect(screen.getByText(/redirecting to \/unauthorized/i)).toBeInTheDocument();
  });

  test('should preserve location state for redirect after login', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;

    render(
      <MemoryRouter initialEntries={[{ pathname: '/protected-page', search: '?tab=settings' }]}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { 
        from: expect.objectContaining({ 
          pathname: '/protected-page',
          search: '?tab=settings'
        })
      },
      replace: true
    });
  });

  test('should allow custom redirect path', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;

    render(
      <MemoryRouter>
        <ProtectedRoute redirectTo="/custom-login">
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText(/redirecting to \/custom-login/i)).toBeInTheDocument();
  });

  test('should handle permission check function', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { 
      id: 1, 
      email: 'user@example.com', 
      role: 'user',
      permissions: ['read', 'write']
    };

    const hasPermission = (user) => user.permissions?.includes('write');

    render(
      <MemoryRouter>
        <ProtectedRoute permissionCheck={hasPermission}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('should redirect when permission check fails', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { 
      id: 1, 
      email: 'user@example.com', 
      role: 'user',
      permissions: ['read']
    };

    const hasPermission = (user) => user.permissions?.includes('delete');

    render(
      <MemoryRouter>
        <ProtectedRoute permissionCheck={hasPermission}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('navigate-component')).toBeInTheDocument();
    expect(screen.getByText(/redirecting to \/unauthorized/i)).toBeInTheDocument();
  });

  test('should render custom loading component', () => {
    mockAuth.loading = true;

    const CustomLoading = () => <div data-testid="custom-loading">Custom Loading...</div>;

    render(
      <MemoryRouter>
        <ProtectedRoute loadingComponent={<CustomLoading />}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  test('should render custom unauthorized component', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'user@example.com', role: 'user' };

    const CustomUnauthorized = () => <div data-testid="custom-unauthorized">Access Denied</div>;

    render(
      <MemoryRouter>
        <ProtectedRoute 
          requiredRole="admin" 
          unauthorizedComponent={<CustomUnauthorized />}
        >
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('custom-unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-component')).not.toBeInTheDocument();
  });

  test('should handle authentication error', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;
    mockAuth.error = 'Authentication failed';

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    // Should still redirect to login on error
    expect(screen.getByTestId('navigate-component')).toBeInTheDocument();
    expect(screen.getByText(/redirecting to \/login/i)).toBeInTheDocument();
  });

  test('should work with nested protected routes', () => {
    mockAuth.loading = false;
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: 1, email: 'admin@example.com', role: 'admin' };

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <ProtectedRoute requiredRole="admin">
            <AdminComponent />
          </ProtectedRoute>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });
});