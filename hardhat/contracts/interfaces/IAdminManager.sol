// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAdminManager {
    enum Role {
        NONE,
        ADMIN,
        CATEGORY_MANAGER,
        BET_MANAGER,
        SUPER_ADMIN
    }
    
    struct Admin {
        Role role;
        bool isActive;
    }

    event AdminAdded(address indexed admin, Role role);
    event AdminUpdated(address indexed admin, Role role, bool isActive);
    event AdminRemoved(address indexed admin);
    event RoleChanged(address indexed admin, Role oldRole, Role newRole);

    function addAdmin(address _admin, Role _role) external;
    
    function updateAdmin(address _admin, Role _role, bool _isActive) external;
    
    function removeAdmin(address _admin) external;
    
    function changeRole(address _admin, Role _newRole) external;
    
    function getAdmin(address _admin) external view returns (Admin memory);
    
    function hasRole(address _admin, Role _role) external view returns (bool);
    
    function isAdmin(address _admin) external view returns (bool);
    
    function getAllAdmins() external view returns (address[] memory);
    
    function getActiveAdmins() external view returns (address[] memory);

    function requireRole(address _admin, Role _role) external view;

    function requireAnyAdminRole(address _admin) external view;
}