import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  redirectTo = '/login',
  fallback = null 
}) => {
  const { isAuthenticated, isLoading, user, isAdmin } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      fallback || (
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Authenticated but admin required and user is not admin
  if (requireAdmin && !isAdmin()) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Acceso Denegado</h3>
            <p className="mb-4">
              Necesitas permisos de administrador para acceder a esta página.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-red-600">
                Usuario actual: <strong>{user?.email}</strong>
              </p>
              <p className="text-sm text-red-600">
                Rol: <strong>{user?.role || 'usuario'}</strong>
              </p>
            </div>
          </div>
          
          <button
            onClick={() => window.history.back()}
            className="mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Volver Atrás
          </button>
        </div>
      </div>
    );
  }

  // User is authenticated and has required permissions
  return children;
};

// Higher-order component for admin-only routes
export const AdminRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute requireAdmin={true} {...props}>
      {children}
    </ProtectedRoute>
  );
};

// Higher-order component for any authenticated user
export const AuthenticatedRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute requireAdmin={false} {...props}>
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;