// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICategoryManager {
    event CategoryCreated(uint256 indexed categoryId);
    event CategoryDeactivated(uint256 indexed categoryId);

    function createCategory() external returns (uint256);
    function deactivateCategory(uint256 _categoryId) external;
    function isCategoryActive(uint256 _categoryId) external view returns (bool);
    function getActiveCategories() external view returns (uint256[] memory);
}