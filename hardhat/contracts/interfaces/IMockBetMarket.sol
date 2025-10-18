// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMockBetMarket {
    enum BetType { BINARY, MULTIPLE_CHOICE, SPORTS }

    struct BetOption {
        string title;
        uint256 totalAmount;  // Mock: uint256 instead of euint64
        uint256 totalShares;
        bool isWinner;
    }

    struct Bet {
        uint256 id;
        string title;
        string description;
        string imageUrl;
        uint256 categoryId;
        uint256 endTime;
        bool isActive;
        bool isResolved;
        uint256 winnerIndex;
        uint256 createdAt;
        uint256 updatedAt;
        bool mustShowLive;
        uint256 liveStartTime;
        uint256 liveEndTime;
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
        uint256 amount;  // Mock: uint256 instead of euint64
        uint256 shares;
        uint256 timestamp;
        bool claimed;
    }

    event BetCreated(uint256 indexed betId, string title, uint256 categoryId);
    event BetPlaced(uint256 indexed betId, address indexed user, uint256 optionIndex, uint256 shares);
    event BetResolved(uint256 indexed betId, uint256 winnerIndex);
    event WinningsClaimed(uint256 indexed betId, address indexed user, uint256 amount);

    function createBet(
        string memory _title,
        string memory _description,
        string memory _imageUrl,
        uint256 _categoryId,
        string[] memory _optionTitles,
        uint256 _endTime,
        bool _mustShowLive,
        uint256 _liveStartTime,
        uint256 _liveEndTime,
        BetType _betType,
        uint256 _minBetAmount,
        uint256 _maxBetAmount
    ) external returns (uint256);

    function placeBet(
        uint256 _betId,
        uint256 _optionIndex,
        bytes calldata _encryptedAmount,  // Mock: ignore encryption
        bytes calldata _proof             // Mock: ignore proof
    ) external;

    function resolveBet(uint256 _betId, uint256 _winnerIndex) external;
    function claimWinnings(uint256 _betId) external payable;

    function getBet(uint256 _betId) external view returns (Bet memory);
    function getBetOption(uint256 _betId, uint256 _optionIndex) external view returns (BetOption memory);
    function getUserBets(address _user) external view returns (UserBet[] memory);
    function getActiveBets() external view returns (uint256[] memory);
    function getBetsByCategory(uint256 _categoryId) external view returns (uint256[] memory);
    function getBetOptions(uint256 _betId) external view returns (BetOption[] memory);
    function getUserBetsForBet(uint256 _betId, address _user) external view returns (UserBet[] memory);
}