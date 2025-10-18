// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAdminManager.sol";
import "./interfaces/ICategoryManager.sol";

contract CategoryManager is ICategoryManager {
    // MINIMAL - Only active status tracking
    mapping(uint256 => bool) private activeCategories;
    uint256 private nextCategoryId = 1;

    IAdminManager public adminManager;

    modifier onlyAdmin() {
        adminManager.requireAnyAdminRole(msg.sender);
        _;
    }

    modifier onlyCategoryManager() {
        require(
            adminManager.hasRole(msg.sender, IAdminManager.Role.CATEGORY_MANAGER) ||
            adminManager.hasRole(msg.sender, IAdminManager.Role.SUPER_ADMIN),
            "Only category manager can call this function"
        );
        _;
    }

    constructor(address _adminManager) {
        adminManager = IAdminManager(_adminManager);
    }

    function createCategory() external onlyCategoryManager returns (uint256) {
        uint256 categoryId = nextCategoryId++;
        activeCategories[categoryId] = true;

        emit CategoryCreated(categoryId);
        return categoryId;
    }

    function deactivateCategory(uint256 _categoryId) external onlyCategoryManager {
        require(activeCategories[_categoryId], "Category does not exist or already inactive");

        activeCategories[_categoryId] = false;
        emit CategoryDeactivated(_categoryId);
    }

    function isCategoryActive(uint256 _categoryId) external view returns (bool) {
        return activeCategories[_categoryId];
    }

    function getActiveCategories() external view returns (uint256[] memory) {
        uint256 count = 0;

        // Count active categories
        for (uint256 i = 1; i < nextCategoryId; i++) {
            if (activeCategories[i]) {
                count++;
            }
        }

        // Create result array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i < nextCategoryId; i++) {
            if (activeCategories[i]) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }
}