// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";

interface IBetMarketCore {
    // Enums
    enum BetType { BINARY, MULTIPLE_CHOICE, NESTED_CHOICE }
    enum Outcome { YES, NO }

    // Structs
    struct Bet {
        uint256 id;
        uint256 endTime;
        bool isActive;
        bool isResolved;
        BetType betType;
        address createdBy;
        uint256 minBetAmount;
        uint256 maxBetAmount;
        uint256 optionCount;
        uint256 createdAt;
        string title;
        string description;
        uint256 liquidityParam;
    }

    struct BetOption {
        string title;
        bool isWinner;
        uint256 publicTotalShares;
        uint256 publicYesShares;
        uint256 publicNoShares;
    }

    // Core getters
    function bets(uint256 betId) external view returns (
        uint256 id,
        uint256 endTime,
        bool isActive,
        bool isResolved,
        BetType betType,
        address createdBy,
        uint256 minBetAmount,
        uint256 maxBetAmount,
        uint256 optionCount,
        uint256 createdAt,
        string memory title,
        string memory description,
        uint256 liquidityParam
    );

    function getBet(uint256 betId) external view returns (Bet memory);
    function getBetOption(uint256 betId, uint256 optionIndex) external view returns (BetOption memory);
    function hasPlacedBet(address user, uint256 betId) external view returns (bool);
    function hasClaimed(address user, uint256 betId) external view returns (bool);

    // Balance management
    function getUserEncryptedBalance(address user) external view returns (euint64);
    function getUserEncryptedBetAmount(address user, uint256 betId, uint256 optionIndex) external view returns (euint64);
    function getUserNestedBetAmount(address user, uint256 betId, uint256 optionIndex, uint8 outcome) external view returns (euint64);

    // Option totals
    function getOptionEncryptedTotal(uint256 betId, uint256 optionIndex) external view returns (euint64);
    function getNestedOptionEncryptedTotal(uint256 betId, uint256 optionIndex, uint8 outcome) external view returns (euint64);
    function getTotalPoolEncrypted(uint256 betId) external view returns (euint64);

    // Setters (only for authorized contracts)
    function setHasClaimed(address user, uint256 betId) external;
    function addToUserBalance(address user, uint256 amount) external;
}
