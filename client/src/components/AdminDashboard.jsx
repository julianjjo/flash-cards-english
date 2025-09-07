import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminApi, statsApi } from '../services/api';

/**
 * AdminDashboard Component
 * 
 * Provides administrative interface for user and system management.
 * Features:
 * - User management (view, edit, delete, role changes)
 * - System statistics and analytics
 * - Flashcard oversight across all users
 * - Admin activity logging display
 * - Bulk operations on users and flashcards
 */

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load data on component mount and tab changes
  useEffect(() => {
    const loadData = async () => {
      if (!isAdmin()) return;
      
      setLoading(true);
      try {
        if (activeTab === 'users') {
          const usersData = await adminApi.getAllUsers({ 
            page: currentPage, 
            limit: itemsPerPage, 
            role: roleFilter !== 'all' ? roleFilter : undefined 
          });
          setUsers(usersData.users || []);
        }
        if (activeTab === 'overview') {
          const stats = await statsApi.getSystemStats();
          setSystemStats(stats);
        }
      } catch (error) {
        console.error('Failed to load admin data:', error);
        setError(error.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab, currentPage, roleFilter]);

  // Clear messages after delay
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Handle user selection for bulk operations
  const handleUserSelect = (userId, checked) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  // Handle individual user actions
  const handleUserAction = async (action, user) => {
    setIsSubmitting(true);
    try {
      switch (action) {
        case 'edit':
          setEditingUser(user);
          setShowUserModal(true);
          break;
        case 'promote':
          await adminApi.promoteUser(user.id);
          setSuccessMessage(`${user.email} has been promoted to admin`);
          break;
        case 'demote':
          await adminApi.demoteUser(user.id);
          setSuccessMessage(`${user.email} has been demoted to user`);
          break;
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
            await adminApi.deleteUser(user.id);
            setSuccessMessage(`${user.email} has been deleted`);
          }
          break;
      }
      // Refresh user list
      if (onGetUsers && action !== 'edit') {
        onGetUsers({ page: currentPage, limit: itemsPerPage, role: roleFilter !== 'all' ? roleFilter : undefined });
      }
    } catch (err) {
      setError(err.message || `Failed to ${action} user`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return;

    const confirmMessage = `Are you sure you want to ${bulkAction} ${selectedUsers.size} user(s)?`;
    if (!window.confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      const promises = Array.from(selectedUsers).map(userId => {
        switch (bulkAction) {
          case 'delete':
            return adminApi.deleteUser(userId);
          case 'promote':
            return adminApi.promoteUser(userId);
          case 'demote':
            return adminApi.demoteUser(userId);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      setSuccessMessage(`Bulk ${bulkAction} completed successfully`);
      setSelectedUsers(new Set());
      setBulkAction('');
      
      // Refresh user list
      const usersData = await adminApi.getAllUsers({ 
        page: currentPage, 
        limit: itemsPerPage, 
        role: roleFilter !== 'all' ? roleFilter : undefined 
      });
      setUsers(usersData.users || []);
    } catch (err) {
      setError(err.message || `Failed to perform bulk ${bulkAction}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle user update from modal
  const handleUserUpdate = async (userData) => {
    setIsSubmitting(true);
    try {
      await adminApi.updateUser(editingUser.id, userData);
      setSuccessMessage(`${userData.email || editingUser.email} has been updated`);
      setShowUserModal(false);
      setEditingUser(null);
      
      // Refresh user list
      const usersData = await adminApi.getAllUsers({ 
        page: currentPage, 
        limit: itemsPerPage, 
        role: roleFilter !== 'all' ? roleFilter : undefined 
      });
      setUsers(usersData.users || []);
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num || 0);
  };

  // Check admin access
  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h2>
          <p className="text-gray-600">You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage users, monitor system performance, and oversee flashcard data</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 py-4">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'User Management', icon: '👥' },
              { id: 'flashcards', label: 'Flashcards', icon: '🗂️' },
              { id: 'activity', label: 'Activity Log', icon: '📝' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Overview</h2>
              {systemStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {formatNumber(systemStats.totalUsers)}
                    </div>
                    <div className="text-sm text-gray-600">Total Users</div>
                    <div className="text-xs text-blue-600 mt-1">
                      {formatNumber(systemStats.newUsers30Days)} new this month
                    </div>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {formatNumber(systemStats.totalFlashcards)}
                    </div>
                    <div className="text-sm text-gray-600">Total Flashcards</div>
                    <div className="text-xs text-green-600 mt-1">
                      Avg difficulty: {systemStats.averageDifficulty}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {formatNumber(systemStats.totalReviews)}
                    </div>
                    <div className="text-sm text-gray-600">Total Reviews</div>
                    <div className="text-xs text-purple-600 mt-1">
                      {formatNumber(systemStats.reviewedLastWeek)} this week
                    </div>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {formatNumber(systemStats.activeUsers)}
                    </div>
                    <div className="text-sm text-gray-600">Active Users</div>
                    <div className="text-xs text-orange-600 mt-1">
                      {systemStats.adminUsers} admin(s)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {/* Role Filter */}
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">Users</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedUsers.size > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4 flex items-center justify-between">
                  <div className="text-sm text-blue-700">
                    {selectedUsers.size} user(s) selected
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value)}
                      className="px-3 py-1 border border-blue-300 rounded text-sm"
                    >
                      <option value="">Select action...</option>
                      <option value="promote">Promote to Admin</option>
                      <option value="demote">Demote to User</option>
                      <option value="delete">Delete Users</option>
                    </select>
                    <button
                      onClick={handleBulkAction}
                      disabled={!bulkAction || isSubmitting}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Users Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flashcards
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(user.id)}
                              onChange={(e) => handleUserSelect(user.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.email}</div>
                                <div className="text-sm text-gray-500">ID: {user.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {user.flashcardCount || 0}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleUserAction('edit', user)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            {user.role === 'user' ? (
                              <button
                                onClick={() => handleUserAction('promote', user)}
                                className="text-purple-600 hover:text-purple-900"
                                disabled={isSubmitting}
                              >
                                Promote
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUserAction('demote', user)}
                                className="text-yellow-600 hover:text-yellow-900"
                                disabled={isSubmitting}
                              >
                                Demote
                              </button>
                            )}
                            <button
                              onClick={() => handleUserAction('delete', user)}
                              className="text-red-600 hover:text-red-900"
                              disabled={isSubmitting}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Other tabs would be implemented similarly */}
          {activeTab === 'flashcards' && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🗂️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Flashcards Management</h3>
              <p className="text-gray-600">This section would show system-wide flashcard management tools.</p>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Log</h3>
              <p className="text-gray-600">This section would show admin activity logs and system events.</p>
            </div>
          )}
        </div>
      </div>

      {/* User Edit Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleUserUpdate({
                  email: formData.get('email'),
                  role: formData.get('role')
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingUser.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Updating...' : 'Update User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;