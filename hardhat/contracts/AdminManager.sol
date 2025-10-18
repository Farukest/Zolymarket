// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAdminManager.sol";

contract AdminManager is IAdminManager {
    // MINIMAL - Only essential admin control

    mapping(address => Admin) private admins;
    address[] private adminList;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlySuperAdmin() {
        require(
            msg.sender == owner ||
            (admins[msg.sender].isActive && admins[msg.sender].role == Role.SUPER_ADMIN),
            "Only super admin can call this function"
        );
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == owner ||
            (admins[msg.sender].isActive && admins[msg.sender].role != Role.NONE),
            "Only admin can call this function"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        // Owner becomes first super admin
        admins[owner] = Admin({
            role: Role.SUPER_ADMIN,
            isActive: true
        });
        adminList.push(owner);
    }
    
    function addAdmin(address _admin, Role _role) external onlySuperAdmin {
        require(_admin != address(0), "Invalid admin address");
        require(_role != Role.NONE, "Invalid role");
        require(admins[_admin].role == Role.NONE, "Admin already exists");

        admins[_admin] = Admin({
            role: _role,
            isActive: true
        });

        adminList.push(_admin);
        emit AdminAdded(_admin, _role);
    }
    
    function updateAdmin(address _admin, Role _role, bool _isActive) external onlySuperAdmin {
        require(admins[_admin].role != Role.NONE, "Admin does not exist");
        require(_admin != owner, "Cannot modify owner");

        Role oldRole = admins[_admin].role;
        admins[_admin].role = _role;
        admins[_admin].isActive = _isActive;

        emit AdminUpdated(_admin, _role, _isActive);
        if (oldRole != _role) {
            emit RoleChanged(_admin, oldRole, _role);
        }
    }

    function removeAdmin(address _admin) external onlySuperAdmin {
        require(admins[_admin].role != Role.NONE, "Admin does not exist");
        require(_admin != owner, "Cannot remove owner");

        // Remove from array
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == _admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }

        delete admins[_admin];
        emit AdminRemoved(_admin);
    }

    function changeRole(address _admin, Role _newRole) external onlySuperAdmin {
        require(admins[_admin].role != Role.NONE, "Admin does not exist");
        require(_admin != owner, "Cannot change owner role");

        Role oldRole = admins[_admin].role;
        admins[_admin].role = _newRole;

        emit RoleChanged(_admin, oldRole, _newRole);
    }

    function getAdmin(address _admin) external view returns (Admin memory) {
        return admins[_admin];
    }
    
    function hasRole(address _admin, Role _role) external view returns (bool) {
        return admins[_admin].isActive && admins[_admin].role == _role;
    }
    
    function isAdmin(address _admin) external view returns (bool) {
        return admins[_admin].isActive && admins[_admin].role != Role.NONE;
    }
    
    function getAllAdmins() external view returns (address[] memory) {
        return adminList;
    }
    
    function getActiveAdmins() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active admins
        for (uint256 i = 0; i < adminList.length; i++) {
            if (admins[adminList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active admins
        address[] memory activeAdmins = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < adminList.length; i++) {
            if (admins[adminList[i]].isActive) {
                activeAdmins[index] = adminList[i];
                index++;
            }
        }
        
        return activeAdmins;
    }
    
    // Role checking functions for other contracts
    function requireRole(address _admin, Role _role) external view {
        require(
            admins[_admin].isActive && admins[_admin].role == _role,
            "Insufficient permissions"
        );
    }
    
    function requireAnyAdminRole(address _admin) external view {
        require(
            admins[_admin].isActive && admins[_admin].role != Role.NONE,
            "Admin role required"
        );
    }
}