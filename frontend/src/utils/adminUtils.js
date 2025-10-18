/**
 * Admin Utility Functions
 * Secure and modular admin access control
 */

// Admin role definitions
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user'
};

// Admin permissions
export const ADMIN_PERMISSIONS = {
  // Bet Management
  CREATE_BET: 'create_bet',
  EDIT_BET: 'edit_bet',
  DELETE_BET: 'delete_bet',
  RESOLVE_BET: 'resolve_bet',

  // User Management
  VIEW_USERS: 'view_users',
  EDIT_USERS: 'edit_users',
  BAN_USERS: 'ban_users',

  // Category Management
  MANAGE_CATEGORIES: 'manage_categories',

  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data',

  // System
  SYSTEM_CONFIG: 'system_config',
  MANAGE_ADMINS: 'manage_admins'
};

// Role-Permission mapping
const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: Object.values(ADMIN_PERMISSIONS),
  [ADMIN_ROLES.ADMIN]: [
    ADMIN_PERMISSIONS.CREATE_BET,
    ADMIN_PERMISSIONS.EDIT_BET,
    ADMIN_PERMISSIONS.DELETE_BET,
    ADMIN_PERMISSIONS.RESOLVE_BET,
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.EDIT_USERS,
    ADMIN_PERMISSIONS.MANAGE_CATEGORIES,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS
  ],
  [ADMIN_ROLES.MODERATOR]: [
    ADMIN_PERMISSIONS.EDIT_BET,
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS
  ],
  [ADMIN_ROLES.USER]: []
};

/**
 * Get admin addresses from environment
 * @returns {Object} Admin configuration
 */
export const getAdminConfig = () => {
  const adminAddresses = import.meta.env.VITE_ADMIN_ADDRESSES?.split(',').map(addr => addr.trim()) || [];
  const superAdmin = import.meta.env.VITE_SUPER_ADMIN?.trim();
  const moderatorAddresses = import.meta.env.VITE_MODERATOR_ADDRESSES?.split(',').map(addr => addr.trim()) || [];

  return {
    adminAddresses,
    superAdmin,
    moderatorAddresses,
    all: [...adminAddresses, ...moderatorAddresses].filter(Boolean)
  };
};

/**
 * Check if address has admin privileges
 * @param {string} address - Wallet address
 * @returns {boolean}
 */
export const isAdmin = (address) => {
  if (!address) return false;

  const config = getAdminConfig();
  return config.adminAddresses.includes(address) || config.superAdmin === address;
};

/**
 * Check if address has super admin privileges
 * @param {string} address - Wallet address
 * @returns {boolean}
 */
export const isSuperAdmin = (address) => {
  if (!address) return false;

  const config = getAdminConfig();
  return config.superAdmin === address;
};

/**
 * Check if address has moderator privileges
 * @param {string} address - Wallet address
 * @returns {boolean}
 */
export const isModerator = (address) => {
  if (!address) return false;

  const config = getAdminConfig();
  return config.moderatorAddresses.includes(address);
};

/**
 * Get user role based on address
 * @param {string} address - Wallet address
 * @returns {string} User role
 */
export const getUserRole = (address) => {
  if (!address) return ADMIN_ROLES.USER;

  if (isSuperAdmin(address)) return ADMIN_ROLES.SUPER_ADMIN;
  if (isAdmin(address)) return ADMIN_ROLES.ADMIN;
  if (isModerator(address)) return ADMIN_ROLES.MODERATOR;

  return ADMIN_ROLES.USER;
};

/**
 * Check if user has specific permission
 * @param {string} address - Wallet address
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (address, permission) => {
  const role = getUserRole(address);
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

/**
 * Get all permissions for a user
 * @param {string} address - Wallet address
 * @returns {Array} Array of permissions
 */
export const getUserPermissions = (address) => {
  const role = getUserRole(address);
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Check if address has any admin privileges (admin, moderator, or super admin)
 * @param {string} address - Wallet address
 * @returns {boolean}
 */
export const hasAnyAdminPrivileges = (address) => {
  return isAdmin(address) || isModerator(address) || isSuperAdmin(address);
};

/**
 * Get user display info
 * @param {string} address - Wallet address
 * @returns {Object} User display information
 */
export const getUserDisplayInfo = (address) => {
  const role = getUserRole(address);

  const displayInfo = {
    [ADMIN_ROLES.SUPER_ADMIN]: {
      badge: '👑',
      label: 'Super Admin',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    [ADMIN_ROLES.ADMIN]: {
      badge: '🛡️',
      label: 'Admin',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    [ADMIN_ROLES.MODERATOR]: {
      badge: '🛠️',
      label: 'Moderator',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    [ADMIN_ROLES.USER]: {
      badge: '👤',
      label: 'User',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30'
    }
  };

  return displayInfo[role];
};

// Development helper - Add your wallet address here for testing
export const DEV_ADMIN_ADDRESS = '0x78c1...5cf9'; // Replace with your actual address

/**
 * Validate admin configuration
 * @returns {Object} Validation result
 */
export const validateAdminConfig = () => {
  const config = getAdminConfig();

  const errors = [];
  const warnings = [];

  if (config.adminAddresses.length === 0) {
    warnings.push('No admin addresses configured');
  }

  if (!config.superAdmin) {
    warnings.push('No super admin configured');
  }

  // Check for duplicate addresses
  const allAddresses = [...config.adminAddresses, config.superAdmin, ...config.moderatorAddresses];
  const duplicates = allAddresses.filter((addr, index) => allAddresses.indexOf(addr) !== index);

  if (duplicates.length > 0) {
    warnings.push(`Duplicate addresses found: ${duplicates.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  };
};