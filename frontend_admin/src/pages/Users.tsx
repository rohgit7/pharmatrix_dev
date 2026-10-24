import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Filter,
  Shield,
  Truck,
  Building2,
  Factory,
  Edit,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Mail,
  Calendar,
  Lock,
} from 'lucide-react';
import { usersApi } from '../api/operations';
import { UserResponse, UserCreate, UserUpdate, UserRole } from '../types/operations';

export const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserResponse | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Queries
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (payload: UserCreate) => usersApi.create(payload),
    onSuccess: (newUser) => {
      showNotification('success', `User account for "${newUser.name}" (${newUser.role}) created`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to create user');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserUpdate }) =>
      usersApi.update(id, payload),
    onSuccess: (updated) => {
      showNotification('success', `User "${updated.name}" updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToEdit(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to update user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      showNotification('success', 'User account permanently removed');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToDelete(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to delete user');
    },
  });

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'INACTIVE' && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Shield className="w-3 h-3" /> System Admin
          </span>
        );
      case 'DRIVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Truck className="w-3 h-3" /> Fleet Driver
          </span>
        );
      case 'CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-3 h-3" /> Healthcare Client
          </span>
        );
      case 'FACILITY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Factory className="w-3 h-3" /> CBMWTF Facility
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-charcoal-700 text-charcoal-300">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-charcoal-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <UsersIcon className="w-7 h-7 text-periwinkle" />
            Users & Access Control
          </h1>
          <p className="text-xs text-charcoal-400 mt-1">
            Complete administration of system accounts, role assignments (Admin, Driver, Customer, Facility), and authentication credentials.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create User Account
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search by full name or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs text-white placeholder-charcoal-500 focus:outline-none focus:border-periwinkle/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-charcoal-900 border border-charcoal-800 px-3 py-1 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-charcoal-400" />
            <span className="text-[10px] text-charcoal-500 uppercase font-bold">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-medium"
            >
              <option value="ALL" className="bg-charcoal-900">All Roles</option>
              <option value="ADMIN" className="bg-charcoal-900">Admins</option>
              <option value="DRIVER" className="bg-charcoal-900">Drivers</option>
              <option value="CUSTOMER" className="bg-charcoal-900">Customers</option>
              <option value="FACILITY" className="bg-charcoal-900">Facilities</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-charcoal-900 border border-charcoal-800 px-3 py-1 rounded-xl">
            <span className="text-[10px] text-charcoal-500 uppercase font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-medium"
            >
              <option value="ALL" className="bg-charcoal-900">All Status</option>
              <option value="ACTIVE" className="bg-charcoal-900">Active Only</option>
              <option value="INACTIVE" className="bg-charcoal-900">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-charcoal-800 flex items-center justify-between">
          <span className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
            User Accounts ({filteredUsers.length})
          </span>
          <button
            onClick={() => refetch()}
            className="text-xs text-periwinkle hover:underline font-semibold"
          >
            Refresh List
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-charcoal-400">Loading user accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-charcoal-500">
            No user accounts found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-charcoal-800 bg-charcoal-800/40 text-[11px] font-bold text-charcoal-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Auth UUID</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800/60">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-charcoal-800/40 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{u.name}</div>
                      <div className="text-charcoal-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-charcoal-500" />
                        {u.email}
                      </div>
                    </td>

                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>

                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> Suspended
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-charcoal-400">
                      {u.auth_user_id.slice(0, 8)}...{u.auth_user_id.slice(-6)}
                    </td>

                    <td className="py-3 px-4 text-charcoal-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-charcoal-500" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setUserToEdit(u)}
                          title="Edit user role or password"
                          className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setUserToDelete(u)}
                          title="Delete user account"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* Create User Modal */}
      {/* ======================================================== */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(payload) => createUserMutation.mutate(payload)}
          isSubmitting={createUserMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Edit User Modal */}
      {/* ======================================================== */}
      {userToEdit && (
        <EditUserModal
          user={userToEdit}
          onClose={() => setUserToEdit(null)}
          onSubmit={(payload) => updateUserMutation.mutate({ id: userToEdit.id, payload })}
          isSubmitting={updateUserMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete User Modal */}
      {/* ======================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete User Account</h3>
            </div>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to delete user <strong className="text-white">"{userToDelete.name}"</strong> ({userToDelete.email})?
              This will remove their system access across all portals.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// Create User Modal Component
// ========================================================
interface CreateUserModalProps {
  onClose: () => void;
  onSubmit: (payload: UserCreate) => void;
  isSubmitting: boolean;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email,
      password: password || undefined,
      role,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-periwinkle" />
            Create User Account
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Email Address *</label>
            <input
              type="email"
              placeholder="ramesh@pharmatrix.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Initial Password (Optional)</label>
            <input
              type="password"
              placeholder="Min 8 characters (or auto-generates invite)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">System Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
            >
              <option value="ADMIN">ADMIN - Control Tower Full Access</option>
              <option value="DRIVER">DRIVER - Mobile Collection App</option>
              <option value="CUSTOMER">CUSTOMER - Generator Waste Portal</option>
              <option value="FACILITY">FACILITY - CBMWTF Treatment Station</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-charcoal-800 border-charcoal-700 text-periwinkle focus:ring-0"
            />
            <label htmlFor="isActive" className="text-charcoal-300">
              Account is active immediately
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// Edit User Modal Component
// ========================================================
interface EditUserModalProps {
  user: UserResponse;
  onClose: () => void;
  onSubmit: (payload: UserUpdate) => void;
  isSubmitting: boolean;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [newPassword, setNewPassword] = useState('');
  const [isActive, setIsActive] = useState(user.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UserUpdate = {
      name,
      email,
      role,
      is_active: isActive,
    };
    if (newPassword.trim()) {
      payload.password = newPassword.trim();
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-periwinkle" />
            Edit User: {user.name}
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
            >
              <option value="ADMIN">ADMIN - Control Tower Full Access</option>
              <option value="DRIVER">DRIVER - Mobile Collection App</option>
              <option value="CUSTOMER">CUSTOMER - Generator Waste Portal</option>
              <option value="FACILITY">FACILITY - CBMWTF Treatment Station</option>
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Reset Password (leave blank to keep current)</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-500" />
              <input
                type="password"
                placeholder="Enter new password to overwrite"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-charcoal-800 border-charcoal-700 text-periwinkle focus:ring-0"
            />
            <label htmlFor="editIsActive" className="text-charcoal-300">
              User account is active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Users;
