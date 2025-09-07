import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute, { AdminRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Profile from './pages/Profile';

// Navigation component to access auth context
function Navigation() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <nav className="bg-white shadow mb-8">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="font-bold text-xl text-blue-600 hover:text-blue-800 transition-colors">
            Flash Cards
          </Link>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow mb-8">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="font-bold text-xl text-blue-600 hover:text-blue-800 transition-colors">
          Flash Cards
        </Link>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            // Authenticated user navigation
            <>
              <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">
                Estudiar
              </Link>
              
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-gray-700 hover:text-blue-600 transition-colors">
                  Administrar
                </Link>
              )}
              
              <Link to="/profile" className="text-gray-700 hover:text-blue-600 transition-colors">
                Mi Perfil
              </Link>
              
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  Hola, <strong>{user?.email}</strong>
                </span>
                
                {user?.role === 'admin' && (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    Admin
                  </span>
                )}
                
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-800 transition-colors text-sm font-medium"
                >
                  Salir
                </button>
              </div>
            </>
          ) : (
            // Guest navigation
            <>
              <Link to="/login" className="text-gray-700 hover:text-blue-600 transition-colors">
                Iniciar Sesión
              </Link>
              <Link 
                to="/login" 
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="container mx-auto px-4">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Auth />} />
          
          {/* Protected Routes - Any authenticated user */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          
          {/* Admin-only Routes */}
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } 
          />
          
          {/* Catch-all redirect to home */}
          <Route path="*" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
