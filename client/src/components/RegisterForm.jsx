import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const RegisterForm = ({ onSuccess, onToggleMode }) => {
  const { register, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear global error when user starts typing
    if (error) {
      clearError();
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'El email no tiene un formato válido';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres';
    } else if (formData.password.length > 128) {
      errors.password = 'La contraseña debe tener menos de 128 caracteres';
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'La contraseña debe contener al menos una letra minúscula';
    } else if (!/[A-Z0-9]/.test(formData.password)) {
      errors.password = 'La contraseña debe contener al menos una letra mayúscula o número';
    }
    
    // Check for common weak passwords
    const weakPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'login', 'welcome', 'guest'
    ];
    
    if (weakPasswords.includes(formData.password.toLowerCase())) {
      errors.password = 'La contraseña es muy común - elige una más segura';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    clearError();
    
    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      const result = await register({
        email: formData.email.trim(),
        password: formData.password
      });
      
      if (result.success) {
        // Clear form
        setFormData({
          email: '',
          password: '',
          confirmPassword: ''
        });
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.user);
        }
      } else {
        // Handle API errors
        if (result.errors) {
          setFormErrors(result.errors);
        }
      }
    } catch (err) {
      // Error is handled by the auth context
      console.error('Registration error:', err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Crear Cuenta</h2>
        
        {/* Global Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Email Field */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
              formErrors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="tu@email.com"
            disabled={isLoading}
            autoComplete="email"
          />
          {formErrors.email && (
            <p className="text-red-500 text-xs italic mt-1">{formErrors.email}</p>
          )}
        </div>
        
        {/* Password Field */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
              formErrors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="••••••••"
            disabled={isLoading}
            autoComplete="new-password"
          />
          {formErrors.password && (
            <p className="text-red-500 text-xs italic mt-1">{formErrors.password}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Mínimo 8 caracteres con al menos una letra minúscula y una mayúscula o número
          </p>
        </div>
        
        {/* Confirm Password Field */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
            Confirmar Contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
              formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="••••••••"
            disabled={isLoading}
            autoComplete="new-password"
          />
          {formErrors.confirmPassword && (
            <p className="text-red-500 text-xs italic mt-1">{formErrors.confirmPassword}</p>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </div>
        
        {/* Toggle to Login */}
        {onToggleMode && (
          <div className="text-center mt-4">
            <p className="text-gray-600 text-sm">
              ¿Ya tienes una cuenta?{' '}
              <button
                type="button"
                onClick={onToggleMode}
                className="text-blue-500 hover:text-blue-700 font-medium"
                disabled={isLoading}
              >
                Inicia sesión aquí
              </button>
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default RegisterForm;