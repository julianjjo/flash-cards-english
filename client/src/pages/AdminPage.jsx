import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../components/AdminDashboard';

/**
 * Admin Page Component
 * 
 * Provides administrative interface for user and system management.
 * Requires admin authentication to access.
 */

const AdminPage = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  // Show loading while checking authentication state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect if not admin
  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminDashboard />
      </div>
    </div>
  );
};

export default AdminPage;