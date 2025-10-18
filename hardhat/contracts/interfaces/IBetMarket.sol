// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";

interface IBetMarket {
    enum BetType { BINARY, MULTIPLE_CHOICE, SPORTS }

    struct BetOption {
        euint64 totalAmount;
        uint256 totalShares;
        bool isWinner;
    }

    struct Bet {
        uint256 id;
        uint256 endTime;
        bool isActive;
        bool isResolved;
        uint256 createdAt;
        uint256 updatedAt;
        BetType betType;
        uint256 optionCount;
        uint256 minBetAmount;
        uint256 maxBetAmount;
        address createdBy;
        uint256 totalParticipants;
    }

    struct UserBet {
        uint256 betId;
        uint256 optionIndex;
        euint64 amount;
        uint256 shares;
        uint256 timestamp;
        bool claimed;
    }

    event BetCreated(uint256 indexed betId, uint256 indexed endTime, uint256 optionCount);
    event BetPlaced(uint256 indexed betId, address indexed user, uint256 optionIndex, uint256 shares);
    event BetResolved(uint256 indexed betId, uint256 winnerIndex);
    event WinningsClaimed(uint256 indexed betId, address indexed user, uint256 amount);

    function createBet(
        uint256 _optionCount,
        uint256 _endTime,
        BetType _betType,
        uint256 _minBetAmount,
        uint256 _maxBetAmount
    ) external returns (uint256);

    function placeBet(
        uint256 _betId,
        uint256 _optionIndex,
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof
    ) external;

    function resolveBet(uint256 _betId, uint256 _winnerIndex) external;
    function claimWinnings(uint256 _betId) external payable; // payable ekledim

    function getBet(uint256 _betId) external view returns (Bet memory);
    function getBetOption(uint256 _betId, uint256 _optionIndex) external view returns (BetOption memory);
    function getUserBets(address _user) external view returns (UserBet[] memory);
    function getActiveBets() external view returns (uint256[] memory);
    function getBetsByCategory(uint256 _categoryId) external view returns (uint256[] memory);
}