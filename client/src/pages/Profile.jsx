import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from '../components/UserProfile';

/**
 * Profile Page Component
 * 
 * Provides user profile management interface.
 * Requires authentication to access.
 */

const Profile = () => {
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
        </div>

        <UserProfile />
      </div>
    </div>
  );
};

export default Profile;