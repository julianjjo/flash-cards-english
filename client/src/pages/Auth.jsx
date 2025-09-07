import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { useAuth } from '../contexts/AuthContext';

const Auth = () => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      // Redirect to the page they were trying to visit, or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state?.from?.pathname]);

  const handleAuthSuccess = (user) => {
    // Authentication successful - redirect to intended destination
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Flash Cards</h1>
          <h2 className="text-xl text-gray-600">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {mode === 'login' 
              ? 'Inicia sesión para continuar estudiando' 
              : 'Regístrate para comenzar a estudiar con tarjetas de memoria'}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {mode === 'login' ? (
          <LoginForm 
            onSuccess={handleAuthSuccess}
            onToggleMode={toggleMode}
          />
        ) : (
          <RegisterForm 
            onSuccess={handleAuthSuccess}
            onToggleMode={toggleMode}
          />
        )}
      </div>

      {/* Additional Info */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Sistema de Repetición Espaciada
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Nuestro sistema utiliza técnicas de repetición espaciada para optimizar tu aprendizaje 
                  y ayudarte a recordar mejor el vocabulario español-inglés.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          ¿Problemas para acceder? Contacta al administrador del sitio.
        </p>
      </div>
    </div>
  );
};

export default Auth;