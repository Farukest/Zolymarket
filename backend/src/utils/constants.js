// Admin roles
const ADMIN_ROLES = {
  NONE: 0,
  ADMIN: 1,
  CATEGORY_MANAGER: 2,
  BET_MANAGER: 3,
  SUPER_ADMIN: 4,
};

// Bet types
const BET_TYPES = {
  MULTIPLE_CHOICE: 1,
  BINARY: 2,
  SPORTS: 3,
};

// Bet statuses
const BET_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
};

// Admin permissions
const PERMISSIONS = {
  CREATE_BETS: 'CREATE_BETS',
  UPDATE_BETS: 'UPDATE_BETS',
  RESOLVE_BETS: 'RESOLVE_BETS',
  DELETE_BETS: 'DELETE_BETS',
  CREATE_CATEGORIES: 'CREATE_CATEGORIES',
  UPDATE_CATEGORIES: 'UPDATE_CATEGORIES',
  DELETE_CATEGORIES: 'DELETE_CATEGORIES',
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_ADMINS: 'MANAGE_ADMINS',
  SYSTEM_SETTINGS: 'SYSTEM_SETTINGS',
};

// Response messages
const MESSAGES = {
  SUCCESS: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    FOUND: 'Resource found successfully',
  },
  ERROR: {
    NOT_FOUND: 'Resource not found',
    VALIDATION_FAILED: 'Validation failed',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    SERVER_ERROR: 'Internal server error',
  },
};

module.exports = {
  ADMIN_ROLES,
  BET_TYPES,
  BET_STATUS,
  PERMISSIONS,
  MESSAGES,
};
