import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const AdminUserManagement = ({ selectedUser, onUserUpdate, onUserDelete }) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  // Clear messages when user changes
  useEffect(() => {
    setError(null);
    setSuccessMessage('');
    setShowDeleteConfirm(false);
  }, [selectedUser?.id]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleRoleChange = async (newRole) => {
    if (!selectedUser) return;
    
    setRoleChangeLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const result = await authService.updateUserRole(selectedUser.id, newRole);
      
      if (result.success) {
        setSuccessMessage(`Rol actualizado exitosamente a ${newRole === 'admin' ? 'Administrador' : 'Usuario'}`);
        
        // Update the selected user data
        const updatedUser = {
          ...selectedUser,
          role: newRole
        };
        
        if (onUserUpdate) {
          onUserUpdate(updatedUser);
        }
      } else {
        setError(result.message || 'Error al actualizar el rol');
      }
    } catch (err) {
      setError(err.message || 'Error al actualizar el rol');
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const result = await authService.deleteUser(selectedUser.id);
      
      if (result.success) {
        setSuccessMessage('Usuario eliminado exitosamente');
        setShowDeleteConfirm(false);
        
        if (onUserDelete) {
          onUserDelete(selectedUser);
        }
      } else {
        setError(result.message || 'Error al eliminar el usuario');
      }
    } catch (err) {
      setError(err.message || 'Error al eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCurrentUser = selectedUser?.id === currentUser?.id;
  const canChangeRole = selectedUser && !isCurrentUser;
  const canDeleteUser = selectedUser && !isCurrentUser;

  if (!selectedUser) {
    return (
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-8 text-center text-gray-500">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un Usuario</h3>
          <p className="text-gray-500">
            Selecciona un usuario de la lista para ver y gestionar sus detalles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Detalles del Usuario
          </h3>
          {isCurrentUser && (
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              Tú
            </span>
          )}
        </div>
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

      {/* User Info */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ID</label>
              <p className="mt-1 text-sm text-gray-900 font-mono">{selectedUser.id}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-lg text-gray-900">{selectedUser.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Rol Actual</label>
              <div className="mt-1 flex items-center space-x-3">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  selectedUser.role === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {selectedUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de Registro</label>
              <p className="mt-1 text-sm text-gray-900">
                {formatDate(selectedUser.created_at)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Última Actualización</label>
              <p className="mt-1 text-sm text-gray-900">
                {formatDate(selectedUser.updated_at)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Último Acceso</label>
              <div className="mt-1 flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${
                  selectedUser.last_login && new Date(selectedUser.last_login) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    ? 'bg-green-400'
                    : 'bg-gray-300'
                }`}></div>
                <p className="text-sm text-gray-900">
                  {selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Nunca'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Management Actions */}
      <div className="bg-gray-50 px-6 py-4 border-t space-y-4">
        {/* Role Management */}
        {canChangeRole && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Cambiar Rol
            </label>
            <div className="flex space-x-3">
              <button
                onClick={() => handleRoleChange('user')}
                disabled={selectedUser.role === 'user' || roleChangeLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  selectedUser.role === 'user'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } ${roleChangeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {roleChangeLoading && selectedUser.role === 'admin' ? 'Cambiando...' : 'Hacer Usuario'}
              </button>
              
              <button
                onClick={() => handleRoleChange('admin')}
                disabled={selectedUser.role === 'admin' || roleChangeLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  selectedUser.role === 'admin'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                } ${roleChangeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {roleChangeLoading && selectedUser.role === 'user' ? 'Cambiando...' : 'Hacer Admin'}
              </button>
            </div>
          </div>
        )}

        {/* Self-management notice */}
        {isCurrentUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Este es tu perfil. No puedes modificar tu propio rol o eliminar tu cuenta desde aquí.
                  Usa la sección "Mi Perfil" para gestionar tu cuenta.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delete User */}
        {canDeleteUser && (
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-red-700 mb-3">
              Zona Peligrosa
            </label>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Eliminar Usuario
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p className="font-bold">¡Advertencia!</p>
                  <p>
                    Estás a punto de eliminar permanentemente al usuario <strong>{selectedUser.email}</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleDeleteUser}
                    disabled={loading}
                    className={`bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? 'Eliminando...' : 'Confirmar Eliminación'}
                  </button>
                  
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;