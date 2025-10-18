import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle,
  DollarSign,
  Target,
  Calendar,
  Download,
  Eye,
  AlertTriangle,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchUsers();
  }, [filters, pagination.page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Mock users for development
      const mockUsers = [
        {
          _id: '1',
          address: 'benim_adresim',
          role: 'super_admin',
          status: 'active',
          totalBets: 45,
          totalVolume: 12500,
          winRate: 68,
          joinedAt: '2024-01-15T10:30:00Z',
          lastActive: '2024-09-20T12:00:00Z',
          isVerified: true
        },
        {
          _id: '2',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'user',
          status: 'active',
          totalBets: 23,
          totalVolume: 5600,
          winRate: 52,
          joinedAt: '2024-02-10T14:20:00Z',
          lastActive: '2024-09-19T16:45:00Z',
          isVerified: true
        },
        {
          _id: '3',
          address: '0xabcdef1234567890abcdef1234567890abcdef12',
          role: 'user',
          status: 'active',
          totalBets: 67,
          totalVolume: 18900,
          winRate: 74,
          joinedAt: '2024-01-25T09:15:00Z',
          lastActive: '2024-09-20T08:30:00Z',
          isVerified: false
        },
        {
          _id: '4',
          address: '0x9876543210fedcba9876543210fedcba98765432',
          role: 'moderator',
          status: 'active',
          totalBets: 34,
          totalVolume: 8700,
          winRate: 61,
          joinedAt: '2024-03-05T11:45:00Z',
          lastActive: '2024-09-18T20:15:00Z',
          isVerified: true
        },
        {
          _id: '5',
          address: '0xfedcba9876543210fedcba9876543210fedcba98',
          role: 'user',
          status: 'banned',
          totalBets: 12,
          totalVolume: 2300,
          winRate: 25,
          joinedAt: '2024-04-12T13:30:00Z',
          lastActive: '2024-08-15T10:20:00Z',
          isVerified: false
        }
      ];

      // Apply filters
      let filteredUsers = mockUsers;

      if (filters.search) {
        filteredUsers = filteredUsers.filter(user =>
          user.address.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      if (filters.role !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.role === filters.role);
      }

      if (filters.status !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === filters.status);
      }

      // Apply sorting
      filteredUsers.sort((a, b) => {
        let aValue = a[filters.sortBy];
        let bValue = b[filters.sortBy];

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (filters.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Apply pagination
      const startIndex = (pagination.page - 1) * pagination.limit;
      const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pagination.limit);

      setUsers(paginatedUsers);
      setPagination(prev => ({
        ...prev,
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / pagination.limit)
      }));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        console.log('✅ User role updated successfully via API');
        fetchUsers(); // Refresh list to show updated role
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('Failed to update user role. This feature requires a backend API to be running.');
    }
  };

  const handleUserStatusChange = async (userId, action) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        console.log(`✅ User ${action} successfully via API`);
        fetchUsers(); // Refresh list to show updated status
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      alert(`Failed to ${action} user. This feature requires a backend API to be running.`);
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const UserCard = ({ user }) => (
    <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {user.address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{formatAddress(user.address)}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                  user.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'}
              `}>
                {user.role}
              </span>
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
              `}>
                {user.isActive ? 'Active' : 'Suspended'}
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{user.totalBets || 0}</p>
          <p className="text-xs text-gray-600">Total Bets</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">${user.totalVolume?.toLocaleString() || '0'}</p>
          <p className="text-xs text-gray-600">Volume</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{user.winRate || '0'}%</p>
          <p className="text-xs text-gray-600">Win Rate</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          Joined {formatDate(user.createdAt)}
        </span>
        <span>Last active: {user.lastActive ? formatDate(user.lastActive) : 'Never'}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedUser(user);
            setShowUserModal(true);
          }}
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </Button>

        {user.role !== 'admin' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRoleChange(user._id, user.role === 'moderator' ? 'user' : 'moderator')}
          >
            {user.role === 'moderator' ? (
              <>
                <ShieldOff className="w-4 h-4 mr-1" />
                Remove Mod
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-1" />
                Make Mod
              </>
            )}
          </Button>
        )}

        <Button
          size="sm"
          variant={user.isActive ? "danger" : "success"}
          onClick={() => handleUserStatusChange(user._id, user.isActive ? 'suspend' : 'activate')}
        >
          {user.isActive ? (
            <>
              <Ban className="w-4 h-4 mr-1" />
              Suspend
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-1" />
              Activate
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const UserModal = () => {
    if (!selectedUser) return null;

    return (
      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setSelectedUser(null);
        }}
        title="User Details"
        size="lg"
      >
        <div className="space-y-6">
          {/* User Header */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-xl-lg">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {selectedUser.address.slice(2, 4).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">{formatAddress(selectedUser.address)}</h3>
              <p className="text-gray-600">Full Address: {selectedUser.address}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${selectedUser.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    selectedUser.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}
                `}>
                  {selectedUser.role}
                </span>
                <span className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                `}>
                  {selectedUser.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{selectedUser.totalBets || 0}</p>
              <p className="text-sm text-gray-600">Total Bets</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">${selectedUser.totalVolume?.toLocaleString() || '0'}</p>
              <p className="text-sm text-gray-600">Total Volume</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{selectedUser.winRate || '0'}%</p>
              <p className="text-sm text-gray-600">Win Rate</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <Wallet className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">${selectedUser.balance?.toLocaleString() || '0'}</p>
              <p className="text-sm text-gray-600">Current Balance</p>
            </div>
          </div>

          {/* Account Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Account Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">User ID:</span>
                  <span className="font-medium">{selectedUser._id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Join Date:</span>
                  <span className="font-medium">{formatDate(selectedUser.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Active:</span>
                  <span className="font-medium">
                    {selectedUser.lastActive ? formatDate(selectedUser.lastActive) : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email Verified:</span>
                  <span className="font-medium">
                    {selectedUser.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Activity Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Bets:</span>
                  <span className="font-medium">{selectedUser.activeBets || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Won Bets:</span>
                  <span className="font-medium">{selectedUser.wonBets || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lost Bets:</span>
                  <span className="font-medium">{selectedUser.lostBets || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Profit/Loss:</span>
                  <span className={`font-medium ${
                    (selectedUser.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${selectedUser.profitLoss?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Recent Activity</h4>
            <div className="bg-white rounded-xl-lg p-4 max-h-60 overflow-y-auto">
              {selectedUser.recentActivity?.length > 0 ? (
                <div className="space-y-2">
                  {selectedUser.recentActivity.map((activity, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{activity.action}</span>
                      <span className="text-gray-600">{formatDate(activity.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center">No recent activity</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowUserModal(false);
                setSelectedUser(null);
              }}
            >
              Close
            </Button>
            <Button
              variant={selectedUser.isActive ? "danger" : "success"}
              onClick={() => {
                handleUserStatusChange(selectedUser._id, selectedUser.isActive ? 'suspend' : 'activate');
                setShowUserModal(false);
                setSelectedUser(null);
              }}
            >
              {selectedUser.isActive ? 'Suspend User' : 'Activate User'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">Manage platform users, roles, and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Users
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.role === 'admin' || u.role === 'moderator').length}
              </p>
              <p className="text-sm text-gray-600">Staff Members</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => !u.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Suspended</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={filters.role}
            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="moderator">Moderators</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="createdAt">Join Date</option>
            <option value="lastActive">Last Active</option>
            <option value="totalVolume">Volume</option>
            <option value="totalBets">Total Bets</option>
          </select>

          <select
            value={filters.sortOrder}
            onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" text="Loading users..." />
        </div>
      ) : users.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {users.map(user => (
              <UserCard key={user._id} user={user} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={pagination.page === page ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page }))}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl-xl shadow-sm border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-600">
            {filters.search || filters.role !== 'all' || filters.status !== 'all'
              ? 'Try adjusting your filters to see more results.'
              : 'Users will appear here as they join the platform.'
            }
          </p>
        </div>
      )}

      {/* User Detail Modal */}
      <UserModal />
    </div>
  );
};

export default UserManagement;