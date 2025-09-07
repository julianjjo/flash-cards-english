import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile = () => {
  const { user, updateProfile, deleteAccount, logout, isLoading, error, clearError } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || ''
  });
  const [deleteData, setDeleteData] = useState({
    password: '',
    confirmDelete: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

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
  };

  const handleDeleteChange = (e) => {
    const { name, value } = e.target;
    setDeleteData(prev => ({
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
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'El email no tiene un formato válido';
    }
    
    return errors;
  };

  const validateDeleteForm = () => {
    const errors = {};
    
    if (!deleteData.password) {
      errors.password = 'La contraseña es requerida';
    }
    
    if (deleteData.confirmDelete !== 'ELIMINAR') {
      errors.confirmDelete = 'Debes escribir "ELIMINAR" para confirmar';
    }
    
    return errors;
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setFormData({
      email: user?.email || ''
    });
    clearError();
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      email: user?.email || ''
    });
    setFormErrors({});
    clearError();
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    // Clear previous errors and messages
    setFormErrors({});
    clearError();
    setSuccessMessage('');
    
    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      const result = await updateProfile({
        email: formData.email.trim()
      });
      
      if (result.success) {
        setIsEditing(false);
        setSuccessMessage('Perfil actualizado exitosamente');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        if (result.errors) {
          setFormErrors(result.errors);
        }
      }
    } catch (err) {
      console.error('Profile update error:', err);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    clearError();
    
    // Validate delete form
    const errors = validateDeleteForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      const result = await deleteAccount(deleteData.password);
      
      if (result.success) {
        // Account deleted, user will be logged out automatically
        // Redirect handled by the auth context
      } else {
        if (result.errors) {
          setFormErrors(result.errors);
        }
      }
    } catch (err) {
      console.error('Account deletion error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-gray-600">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Mi Perfil</h2>
        </div>
        
        {/* Success Message */}
        {successMessage && (
          <div className="mx-6 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {/* Profile Content */}
        <div className="px-6 py-6">
          {!isEditing ? (
            // View Mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-lg text-gray-900">{user.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Miembro desde</label>
                <p className="mt-1 text-gray-900">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : 'N/A'}
                </p>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleEditClick}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Editar Perfil
                </button>
                
                <button
                  onClick={handleLogout}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleUpdateProfile}>
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
                  disabled={isLoading}
                  autoComplete="email"
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs italic mt-1">{formErrors.email}</p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Danger Zone */}
        <div className="bg-red-50 border-t border-red-200 px-6 py-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Zona Peligrosa</h3>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Eliminar Cuenta
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p className="font-bold">¡Advertencia!</p>
                <p>Esta acción no se puede deshacer. Se eliminarán todos tus datos permanentemente.</p>
              </div>
              
              <div>
                <label className="block text-red-700 text-sm font-bold mb-2" htmlFor="password">
                  Confirma tu contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={deleteData.password}
                  onChange={handleDeleteChange}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                {formErrors.password && (
                  <p className="text-red-500 text-xs italic mt-1">{formErrors.password}</p>
                )}
              </div>
              
              <div>
                <label className="block text-red-700 text-sm font-bold mb-2" htmlFor="confirmDelete">
                  Escribe "ELIMINAR" para confirmar
                </label>
                <input
                  id="confirmDelete"
                  name="confirmDelete"
                  type="text"
                  value={deleteData.confirmDelete}
                  onChange={handleDeleteChange}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                    formErrors.confirmDelete ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                  placeholder="ELIMINAR"
                />
                {formErrors.confirmDelete && (
                  <p className="text-red-500 text-xs italic mt-1">{formErrors.confirmDelete}</p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Eliminando...' : 'Confirmar Eliminación'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteData({ password: '', confirmDelete: '' });
                    setFormErrors({});
                  }}
                  disabled={isLoading}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;