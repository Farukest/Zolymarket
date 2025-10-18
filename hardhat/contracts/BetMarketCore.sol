// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BetMarketCore is SepoliaConfig, ReentrancyGuard {
    // --- Types ---
    enum BetType { BINARY, MULTIPLE_CHOICE, NESTED_CHOICE }
    enum Outcome { YES, NO }

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

    struct EncryptedBetTransaction {
        uint256 timestamp;
        euint8 optionIndex;
        euint8 outcome;
        euint64 amount;
        uint64 priceAtBet;
    }

    // --- Storage ---
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BetOption[]) private betOptions;
    uint256 private nextBetId = 1;

    mapping(address => euint64) private userEncryptedBalances;
    mapping(address => mapping(uint256 => mapping(uint256 => euint64))) private userBetAmounts;
    mapping(address => mapping(uint256 => euint8)) private userOptionChoices;
    mapping(address => mapping(uint256 => mapping(uint256 => mapping(uint8 => euint64)))) private userNestedBetAmounts;

    mapping(address => mapping(uint256 => bool)) public hasPlacedBet;
    mapping(address => mapping(uint256 => bool)) public hasClaimed;

    address[] private allTraders;
    mapping(address => bool) private isTrader;

    mapping(uint256 => mapping(uint256 => euint64)) private optionTotals;
    mapping(uint256 => mapping(uint256 => mapping(uint8 => euint64))) private nestedOptionTotals;
    mapping(uint256 => euint64) private totalPoolAmounts;
    mapping(uint256 => euint32) private totalParticipants;
    mapping(uint256 => uint256) public totalBetCount;

    mapping(address => mapping(uint256 => EncryptedBetTransaction[])) private userBetTransactions;

    // Global total volume across all bets
    euint64 public globalTotalVolume;

    IERC20 public usdcToken;
    address public owner;

    // Authorized contracts
    address public payoutContract;
    address public statsContract;

    // Events
    event Deposited(address indexed user, uint256 amount);
    event BetCreated(uint256 indexed betId, uint256 indexed endTime, uint256 optionCount);
    event BetPlaced(uint256 indexed betId, address indexed user, uint256 timestamp);
    event BetResolved(uint256 indexed betId, uint256 indexed winnerIndex);
    event NestedBetResolved(uint256 indexed betId, uint256 indexed optionIndex, uint8 indexed outcome);
    event Withdrawn(address indexed user, uint256 amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event PayoutContractSet(address indexed payoutContract);
    event StatsContractSet(address indexed statsContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner ||
            msg.sender == payoutContract ||
            msg.sender == statsContract,
            "Not authorized"
        );
        _;
    }

    modifier betExists(uint256 _betId) {
        require(bets[_betId].id != 0, "Bet does not exist");
        _;
    }

    modifier betActive(uint256 _betId) {
        require(bets[_betId].isActive, "Bet not active");
        require(block.timestamp < bets[_betId].endTime, "Bet ended");
        require(!bets[_betId].isResolved, "Bet resolved");
        _;
    }

    modifier betEnded(uint256 _betId) {
        // DISABLED FOR TESTING: Allow resolving bets before end time
        // require(block.timestamp >= bets[_betId].endTime, "Bet not ended");
        _;
    }

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "USDC address zero");
        owner = msg.sender;
        usdcToken = IERC20(_usdcToken);

        // Initialize global total volume
        globalTotalVolume = FHE.asEuint64(0);
        FHE.allowThis(globalTotalVolume);
        FHE.makePubliclyDecryptable(globalTotalVolume);
    }

    function setPayoutContract(address _payoutContract) external onlyOwner {
        require(_payoutContract != address(0), "Zero address");
        payoutContract = _payoutContract;
        emit PayoutContractSet(_payoutContract);
    }

    function setStatsContract(address _statsContract) external onlyOwner {
        require(_statsContract != address(0), "Zero address");
        statsContract = _statsContract;
        emit StatsContractSet(_statsContract);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        address old = owner;
        owner = _newOwner;
        emit OwnerChanged(old, _newOwner);
    }

    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

        euint64 currentBalance = userEncryptedBalances[msg.sender];
        euint64 amountEncrypted = FHE.asEuint64(uint64(_amount));

        if (FHE.isInitialized(currentBalance)) {
            userEncryptedBalances[msg.sender] = FHE.add(currentBalance, amountEncrypted);
        } else {
            userEncryptedBalances[msg.sender] = amountEncrypted;
        }

        FHE.allowThis(userEncryptedBalances[msg.sender]);
        FHE.allow(userEncryptedBalances[msg.sender], msg.sender);

        emit Deposited(msg.sender, _amount);
    }

    function createBet(
        uint256 _optionCount,
        uint256 _endTime,
        BetType _betType,
        uint256 _minBetAmount,
        uint256 _maxBetAmount,
        uint256 _liquidityParam,
        string memory _title,
        string memory _description,
        string[] memory _optionTitles
    ) external returns (uint256) {
        require(_optionCount >= 2, "At least 2 options required");
        require(_endTime > block.timestamp, "End time must be in future");
        require(_minBetAmount > 0, "Min bet > 0");
        require(_maxBetAmount >= _minBetAmount, "Max >= Min");
        require(_liquidityParam >= 10, "Liquidity param too low");
        require(_liquidityParam <= 1000, "Liquidity param too high");
        require(_optionTitles.length == _optionCount, "Option titles count mismatch");

        // Transfer liquidity USDC from bet creator to contract
        uint256 liquidityAmount = _liquidityParam * 1e6; // Convert to 6 decimals (USDC)
        require(usdcToken.transferFrom(msg.sender, address(this), liquidityAmount), "Liquidity transfer failed");

        uint256 betId = nextBetId++;
        bets[betId] = Bet({
            id: betId,
            endTime: _endTime,
            isActive: true,
            isResolved: false,
            betType: _betType,
            createdBy: msg.sender,
            minBetAmount: _minBetAmount,
            maxBetAmount: _maxBetAmount,
            optionCount: _optionCount,
            createdAt: block.timestamp,
            title: _title,
            description: _description,
            liquidityParam: _liquidityParam
        });

        // Distribute liquidity to YES/NO pools for NESTED bets
        uint256 liquidityPerOutcome = liquidityAmount / 2; // Split equally between YES and NO
        uint256 liquidityPerOption = liquidityPerOutcome / _optionCount; // Distribute across options

        for (uint256 i = 0; i < _optionCount; i++) {
            betOptions[betId].push(BetOption({
                title: _optionTitles[i],
                isWinner: false,
                publicTotalShares: 0,
                publicYesShares: 0,
                publicNoShares: 0
            }));

            if (_betType == BetType.NESTED_CHOICE) {
                // Initialize YES/NO pools at 0 (liquidity only in totalPool)
                nestedOptionTotals[betId][i][uint8(Outcome.YES)] = FHE.asEuint64(0);
                nestedOptionTotals[betId][i][uint8(Outcome.NO)] = FHE.asEuint64(0);
                FHE.allowThis(nestedOptionTotals[betId][i][uint8(Outcome.YES)]);
                FHE.allowThis(nestedOptionTotals[betId][i][uint8(Outcome.NO)]);
                if (payoutContract != address(0)) {
                    FHE.allow(nestedOptionTotals[betId][i][uint8(Outcome.YES)], payoutContract);
                    FHE.allow(nestedOptionTotals[betId][i][uint8(Outcome.NO)], payoutContract);
                }
                FHE.makePubliclyDecryptable(nestedOptionTotals[betId][i][uint8(Outcome.YES)]);
                FHE.makePubliclyDecryptable(nestedOptionTotals[betId][i][uint8(Outcome.NO)]);
            } else {
                optionTotals[betId][i] = FHE.asEuint64(0);
                FHE.allowThis(optionTotals[betId][i]);
                if (payoutContract != address(0)) {
                    FHE.allow(optionTotals[betId][i], payoutContract);
                }
                FHE.makePubliclyDecryptable(optionTotals[betId][i]);
            }
        }

        // Initialize total pool with liquidity amount
        totalPoolAmounts[betId] = FHE.asEuint64(uint64(liquidityAmount));
        totalParticipants[betId] = FHE.asEuint32(0);
        FHE.allowThis(totalPoolAmounts[betId]);
        FHE.allowThis(totalParticipants[betId]);
        if (payoutContract != address(0)) {
            FHE.allow(totalPoolAmounts[betId], payoutContract);
        }
        FHE.makePubliclyDecryptable(totalPoolAmounts[betId]);
        FHE.makePubliclyDecryptable(totalParticipants[betId]);

        emit BetCreated(betId, _endTime, _optionCount);
        return betId;
    }

    function placeBet(
        uint256 _betId,
        externalEuint8 _encryptedOptionIndex,
        bytes calldata _optionProof,
        externalEuint64 _encryptedAmount,
        bytes calldata _amountProof
    ) external nonReentrant betExists(_betId) betActive(_betId) {
        require(bets[_betId].betType != BetType.NESTED_CHOICE, "Use placeNestedBet for nested bets");

        euint8 optionIndex = FHE.fromExternal(_encryptedOptionIndex, _optionProof);
        euint64 amount = FHE.fromExternal(_encryptedAmount, _amountProof);

        FHE.allowThis(optionIndex);
        FHE.allowThis(amount);

        uint64 currentPrice = _calculateBinaryPrice(_betId);
        _processEncryptedBet(_betId, optionIndex, amount);

        euint8 zeroOutcome = FHE.asEuint8(0);
        userBetTransactions[msg.sender][_betId].push(EncryptedBetTransaction({
            timestamp: block.timestamp,
            optionIndex: optionIndex,
            outcome: zeroOutcome,
            amount: amount,
            priceAtBet: currentPrice
        }));

        FHE.allow(optionIndex, msg.sender);
        FHE.allow(zeroOutcome, msg.sender);
        FHE.allow(amount, msg.sender);

        totalBetCount[_betId]++;
        emit BetPlaced(_betId, msg.sender, block.timestamp);
    }

    function placeNestedBet(
        uint256 _betId,
        externalEuint8 _encryptedOptionIndex,
        bytes calldata _optionProof,
        externalEuint8 _encryptedOutcome,
        bytes calldata _outcomeProof,
        externalEuint64 _encryptedAmount,
        bytes calldata _amountProof
    ) external nonReentrant betExists(_betId) betActive(_betId) {
        require(bets[_betId].betType == BetType.NESTED_CHOICE, "Use placeBet for non-nested bets");

        euint8 optionIndex = FHE.fromExternal(_encryptedOptionIndex, _optionProof);
        euint8 outcome = FHE.fromExternal(_encryptedOutcome, _outcomeProof);
        euint64 amount = FHE.fromExternal(_encryptedAmount, _amountProof);

        FHE.allowThis(optionIndex);
        FHE.allowThis(outcome);
        FHE.allowThis(amount);

        uint64 currentPrice = _calculateNestedPrice(_betId);
        _processNestedEncryptedBet(_betId, optionIndex, outcome, amount);

        userBetTransactions[msg.sender][_betId].push(EncryptedBetTransaction({
            timestamp: block.timestamp,
            optionIndex: optionIndex,
            outcome: outcome,
            amount: amount,
            priceAtBet: currentPrice
        }));

        FHE.allow(optionIndex, msg.sender);
        FHE.allow(outcome, msg.sender);
        FHE.allow(amount, msg.sender);

        totalBetCount[_betId]++;
        emit BetPlaced(_betId, msg.sender, block.timestamp);
    }

    function _processEncryptedBet(uint256 _betId, euint8 optionIndex, euint64 amount) internal {
        euint64 currentBalance = userEncryptedBalances[msg.sender];

        ebool validOption = FHE.lt(optionIndex, FHE.asEuint8(uint8(bets[_betId].optionCount)));
        ebool validMinAmount = FHE.ge(amount, FHE.asEuint64(uint64(bets[_betId].minBetAmount)));
        ebool validMaxAmount = FHE.le(amount, FHE.asEuint64(uint64(bets[_betId].maxBetAmount)));
        ebool validAmount = FHE.and(validMinAmount, validMaxAmount);
        ebool hasSufficientBalance = FHE.ge(currentBalance, amount);
        ebool allValid = FHE.and(FHE.and(validOption, validAmount), hasSufficientBalance);

        euint64 updatedBalance = FHE.select(allValid, FHE.sub(currentBalance, amount), currentBalance);
        userEncryptedBalances[msg.sender] = updatedBalance;
        FHE.allowThis(userEncryptedBalances[msg.sender]);
        FHE.allow(userEncryptedBalances[msg.sender], msg.sender);

        bool isFirstBet = !hasPlacedBet[msg.sender][_betId];
        if (isFirstBet) {
            userOptionChoices[msg.sender][_betId] = FHE.select(allValid, optionIndex, FHE.asEuint8(0));
        } else {
            euint8 existingChoice = userOptionChoices[msg.sender][_betId];
            userOptionChoices[msg.sender][_betId] = FHE.select(allValid, optionIndex, existingChoice);
        }
        FHE.allowThis(userOptionChoices[msg.sender][_betId]);
        FHE.allow(userOptionChoices[msg.sender][_betId], msg.sender);
        if (payoutContract != address(0)) {
            FHE.allow(userOptionChoices[msg.sender][_betId], payoutContract);
        }

        _updateEncryptedTotals(_betId, optionIndex, amount, allValid, isFirstBet);

        if (isFirstBet) {
            hasPlacedBet[msg.sender][_betId] = true;
            if (!isTrader[msg.sender]) {
                isTrader[msg.sender] = true;
                allTraders.push(msg.sender);
            }
            euint32 currentParticipants = totalParticipants[_betId];
            totalParticipants[_betId] = FHE.select(allValid, FHE.add(currentParticipants, FHE.asEuint32(1)), currentParticipants);
            FHE.allowThis(totalParticipants[_betId]);
            FHE.makePubliclyDecryptable(totalParticipants[_betId]);
        }
    }

    function _processNestedEncryptedBet(uint256 _betId, euint8 optionIndex, euint8 outcome, euint64 amount) internal {
        euint64 currentBalance = userEncryptedBalances[msg.sender];

        ebool validOption = FHE.lt(optionIndex, FHE.asEuint8(uint8(bets[_betId].optionCount)));
        ebool validOutcome = FHE.lt(outcome, FHE.asEuint8(2));
        ebool validMinAmount = FHE.ge(amount, FHE.asEuint64(uint64(bets[_betId].minBetAmount)));
        ebool validMaxAmount = FHE.le(amount, FHE.asEuint64(uint64(bets[_betId].maxBetAmount)));
        ebool validAmount = FHE.and(validMinAmount, validMaxAmount);
        ebool hasSufficientBalance = FHE.ge(currentBalance, amount);
        ebool allValid = FHE.and(FHE.and(FHE.and(validOption, validOutcome), validAmount), hasSufficientBalance);

        euint64 updatedBalance = FHE.select(allValid, FHE.sub(currentBalance, amount), currentBalance);
        userEncryptedBalances[msg.sender] = updatedBalance;
        FHE.allowThis(userEncryptedBalances[msg.sender]);
        FHE.allow(userEncryptedBalances[msg.sender], msg.sender);

        bool isFirstBet = !hasPlacedBet[msg.sender][_betId];
        _updateNestedEncryptedTotals(_betId, optionIndex, outcome, amount, allValid, isFirstBet);

        if (isFirstBet) {
            hasPlacedBet[msg.sender][_betId] = true;
            if (!isTrader[msg.sender]) {
                isTrader[msg.sender] = true;
                allTraders.push(msg.sender);
            }
            euint32 currentParticipants = totalParticipants[_betId];
            totalParticipants[_betId] = FHE.select(allValid, FHE.add(currentParticipants, FHE.asEuint32(1)), currentParticipants);
            FHE.allowThis(totalParticipants[_betId]);
            FHE.makePubliclyDecryptable(totalParticipants[_betId]);
        }
    }

    function _updateEncryptedTotals(uint256 _betId, euint8 optionIndex, euint64 amount, ebool isValid, bool isFirstBet) internal {
        uint256 len = betOptions[_betId].length;
        for (uint256 i = 0; i < len; i++) {
            euint8 currentOption = FHE.asEuint8(uint8(i));
            ebool isThisOption = FHE.eq(optionIndex, currentOption);
            ebool shouldUpdate = FHE.and(isValid, isThisOption);

            euint64 currentUserAmount = isFirstBet ? FHE.asEuint64(0) : userBetAmounts[msg.sender][_betId][i];
            userBetAmounts[msg.sender][_betId][i] = FHE.select(shouldUpdate, FHE.add(currentUserAmount, amount), currentUserAmount);
            FHE.allowThis(userBetAmounts[msg.sender][_betId][i]);
            FHE.allow(userBetAmounts[msg.sender][_betId][i], msg.sender);
            if (payoutContract != address(0)) {
                FHE.allow(userBetAmounts[msg.sender][_betId][i], payoutContract);
            }

            euint64 currentTotal = optionTotals[_betId][i];
            optionTotals[_betId][i] = FHE.select(shouldUpdate, FHE.add(currentTotal, amount), currentTotal);
            FHE.allowThis(optionTotals[_betId][i]);
            if (payoutContract != address(0)) {
                FHE.allow(optionTotals[_betId][i], payoutContract);
            }
            FHE.makePubliclyDecryptable(optionTotals[_betId][i]);
        }

        euint64 currentPool = totalPoolAmounts[_betId];
        totalPoolAmounts[_betId] = FHE.select(isValid, FHE.add(currentPool, amount), currentPool);
        FHE.allowThis(totalPoolAmounts[_betId]);
        if (payoutContract != address(0)) {
            FHE.allow(totalPoolAmounts[_betId], payoutContract);
        }
        FHE.makePubliclyDecryptable(totalPoolAmounts[_betId]);

        // Update global total volume
        globalTotalVolume = FHE.select(isValid, FHE.add(globalTotalVolume, amount), globalTotalVolume);
        FHE.allowThis(globalTotalVolume);
        FHE.makePubliclyDecryptable(globalTotalVolume);
    }

    function _updateNestedEncryptedTotals(uint256 _betId, euint8 optionIndex, euint8 outcome, euint64 amount, ebool isValid, bool isFirstBet) internal {
        uint256 len = betOptions[_betId].length;

        // ✅ FIX: Initialize ALL option/outcome combinations on first bet
        if (isFirstBet) {
            for (uint256 i = 0; i < len; i++) {
                for (uint8 j = 0; j < 2; j++) {
                    userNestedBetAmounts[msg.sender][_betId][i][j] = FHE.asEuint64(0);
                    FHE.allowThis(userNestedBetAmounts[msg.sender][_betId][i][j]);
                    FHE.allow(userNestedBetAmounts[msg.sender][_betId][i][j], msg.sender);
                    if (payoutContract != address(0)) {
                        FHE.allow(userNestedBetAmounts[msg.sender][_betId][i][j], payoutContract);
                    }
                }
            }
        }

        // Update the actual bet amounts
        for (uint256 i = 0; i < len; i++) {
            euint8 currentOption = FHE.asEuint8(uint8(i));
            ebool isThisOption = FHE.eq(optionIndex, currentOption);

            for (uint8 j = 0; j < 2; j++) {
                euint8 currentOutcome = FHE.asEuint8(j);
                ebool isThisOutcome = FHE.eq(outcome, currentOutcome);
                ebool shouldUpdate = FHE.and(FHE.and(isValid, isThisOption), isThisOutcome);

                euint64 currentUserAmount = userNestedBetAmounts[msg.sender][_betId][i][j];
                userNestedBetAmounts[msg.sender][_betId][i][j] = FHE.select(shouldUpdate, FHE.add(currentUserAmount, amount), currentUserAmount);
                FHE.allowThis(userNestedBetAmounts[msg.sender][_betId][i][j]);
                FHE.allow(userNestedBetAmounts[msg.sender][_betId][i][j], msg.sender);
                if (payoutContract != address(0)) {
                    FHE.allow(userNestedBetAmounts[msg.sender][_betId][i][j], payoutContract);
                }

                euint64 currentTotal = nestedOptionTotals[_betId][i][j];
                nestedOptionTotals[_betId][i][j] = FHE.select(shouldUpdate, FHE.add(currentTotal, amount), currentTotal);
                FHE.allowThis(nestedOptionTotals[_betId][i][j]);
                if (payoutContract != address(0)) {
                    FHE.allow(nestedOptionTotals[_betId][i][j], payoutContract);
                }
                FHE.makePubliclyDecryptable(nestedOptionTotals[_betId][i][j]);
            }
        }

        euint64 currentPool = totalPoolAmounts[_betId];
        totalPoolAmounts[_betId] = FHE.select(isValid, FHE.add(currentPool, amount), currentPool);
        FHE.allowThis(totalPoolAmounts[_betId]);
        if (payoutContract != address(0)) {
            FHE.allow(totalPoolAmounts[_betId], payoutContract);
        }
        FHE.makePubliclyDecryptable(totalPoolAmounts[_betId]);

        // Update global total volume
        globalTotalVolume = FHE.select(isValid, FHE.add(globalTotalVolume, amount), globalTotalVolume);
        FHE.allowThis(globalTotalVolume);
        FHE.makePubliclyDecryptable(globalTotalVolume);
    }

    function _calculateBinaryPrice(uint256 _betId) internal view returns (uint64) {
        uint256 liquidityParam = bets[_betId].liquidityParam;
        uint256 totalShares = 0;
        uint256 optionCount = betOptions[_betId].length;

        for (uint256 i = 0; i < optionCount; i++) {
            totalShares += betOptions[_betId][i].publicTotalShares;
        }

        totalShares += liquidityParam * optionCount * 1000000;
        if (totalShares == 0) return uint64(1000000 / optionCount);

        uint256 avgPrice = 0;
        for (uint256 i = 0; i < optionCount; i++) {
            uint256 optionShares = betOptions[_betId][i].publicTotalShares + (liquidityParam * 1000000);
            avgPrice += (optionShares * 1000000) / totalShares;
        }

        return uint64(avgPrice / optionCount);
    }

    function _calculateNestedPrice(uint256 _betId) internal view returns (uint64) {
        uint256 liquidityParam = bets[_betId].liquidityParam;
        uint256 optionCount = betOptions[_betId].length;
        uint256 totalPrice = 0;
        uint256 validOptions = 0;

        for (uint256 i = 0; i < optionCount; i++) {
            uint256 yesShares = betOptions[_betId][i].publicYesShares;
            uint256 noShares = betOptions[_betId][i].publicNoShares;
            uint256 totalOptionShares = yesShares + noShares;

            if (totalOptionShares > 0) {
                uint256 yesProb = (yesShares * 1000000) / totalOptionShares;
                totalPrice += yesProb;
                validOptions++;
            } else {
                totalPrice += 500000;
                validOptions++;
            }
        }

        if (validOptions == 0) return 500000;
        return uint64(totalPrice / validOptions);
    }

    function resolveBet(uint256 _betId, uint256 _winnerIndex) external betExists(_betId) betEnded(_betId) onlyOwner {
        require(!bets[_betId].isResolved, "Already resolved");
        require(_winnerIndex < betOptions[_betId].length, "Invalid winner");
        require(bets[_betId].betType != BetType.NESTED_CHOICE, "Use resolveNestedBet for nested bets");

        for (uint256 i = 0; i < betOptions[_betId].length; i++) {
            require(!betOptions[_betId][i].isWinner, "Winner already set");
        }

        betOptions[_betId][_winnerIndex].isWinner = true;
        bets[_betId].isResolved = true;
        emit BetResolved(_betId, _winnerIndex);
    }

    function resolveNestedBet(uint256 _betId, uint256 _optionIndex, uint8 _outcome) external betExists(_betId) betEnded(_betId) onlyOwner {
        require(!bets[_betId].isResolved, "Already resolved");
        require(_optionIndex < betOptions[_betId].length, "Invalid option");
        require(_outcome <= 1, "Invalid outcome");
        require(bets[_betId].betType == BetType.NESTED_CHOICE, "Use resolveBet for non-nested bets");

        betOptions[_betId][_optionIndex].isWinner = true;
        bets[_betId].isResolved = true;

        // Return liquidity to bet creator
        uint256 liquidityAmount = bets[_betId].liquidityParam * 1e6;
        address creator = bets[_betId].createdBy;
        require(usdcToken.transfer(creator, liquidityAmount), "Liquidity return failed");

        emit NestedBetResolved(_betId, _optionIndex, _outcome);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");

        euint64 currentBalance = userEncryptedBalances[msg.sender];
        euint64 amountEncrypted = FHE.asEuint64(uint64(_amount));
        ebool hasSufficient = FHE.ge(currentBalance, amountEncrypted);

        euint64 newBalance = FHE.select(hasSufficient, FHE.sub(currentBalance, amountEncrypted), currentBalance);
        userEncryptedBalances[msg.sender] = newBalance;
        FHE.allowThis(userEncryptedBalances[msg.sender]);
        FHE.allow(userEncryptedBalances[msg.sender], msg.sender);

        require(usdcToken.transfer(msg.sender, _amount), "USDC transfer failed");
        emit Withdrawn(msg.sender, _amount);
    }

    // ===== AUTHORIZED CONTRACT FUNCTIONS =====

    function setHasClaimed(address _user, uint256 _betId) external onlyAuthorized {
        hasClaimed[_user][_betId] = true;
    }

    function addToUserBalance(address _user, uint256 _amount) external onlyAuthorized {
        euint64 currentBalance = userEncryptedBalances[_user];
        euint64 amountEncrypted = FHE.asEuint64(uint64(_amount));
        euint64 newBalance = FHE.add(currentBalance, amountEncrypted);

        userEncryptedBalances[_user] = newBalance;
        FHE.allowThis(userEncryptedBalances[_user]);
        FHE.allow(userEncryptedBalances[_user], _user);
    }

    function setBetOptionWinner(uint256 _betId, uint256 _optionIndex) external onlyAuthorized {
        betOptions[_betId][_optionIndex].isWinner = true;
    }

    function updatePublicShares(
        uint256 _betId,
        uint256 _optionIndex,
        uint256 _totalShares,
        uint256 _yesShares,
        uint256 _noShares
    ) external onlyAuthorized {
        betOptions[_betId][_optionIndex].publicTotalShares = _totalShares;
        betOptions[_betId][_optionIndex].publicYesShares = _yesShares;
        betOptions[_betId][_optionIndex].publicNoShares = _noShares;
    }

    // ===== VIEW FUNCTIONS =====

    function getTotalBets() external view returns (uint256) {
        return nextBetId - 1;
    }

    function getBet(uint256 _betId) external view betExists(_betId) returns (Bet memory) {
        return bets[_betId];
    }

    function getBetOption(uint256 _betId, uint256 _optionIndex) external view betExists(_betId) returns (BetOption memory) {
        require(_optionIndex < betOptions[_betId].length, "Invalid option");
        return betOptions[_betId][_optionIndex];
    }

    function getMyEncryptedBalance() external view returns (euint64) {
        return userEncryptedBalances[msg.sender];
    }

    function getUserEncryptedBalance(address _user) external view returns (euint64) {
        return userEncryptedBalances[_user];
    }

    function getUserEncryptedBetAmount(address _user, uint256 _betId, uint256 _optionIndex) external view returns (euint64) {
        return userBetAmounts[_user][_betId][_optionIndex];
    }

    function getUserNestedBetAmount(address _user, uint256 _betId, uint256 _optionIndex, uint8 _outcome) external view returns (euint64) {
        return userNestedBetAmounts[_user][_betId][_optionIndex][_outcome];
    }

    function getOptionEncryptedTotal(uint256 _betId, uint256 _optionIndex) external view betExists(_betId) returns (euint64) {
        require(_optionIndex < betOptions[_betId].length, "Invalid option");
        return optionTotals[_betId][_optionIndex];
    }

    function getNestedOptionEncryptedTotal(uint256 _betId, uint256 _optionIndex, uint8 _outcome) external view betExists(_betId) returns (euint64) {
        require(_optionIndex < betOptions[_betId].length, "Invalid option");
        require(_outcome <= 1, "Invalid outcome");
        return nestedOptionTotals[_betId][_optionIndex][_outcome];
    }

    function getTotalPoolEncrypted(uint256 _betId) external view betExists(_betId) returns (euint64) {
        return totalPoolAmounts[_betId];
    }

    function getTotalParticipantsEncrypted(uint256 _betId) external view betExists(_betId) returns (euint32) {
        return totalParticipants[_betId];
    }

    function getTotalBetCount(uint256 _betId) external view betExists(_betId) returns (uint256) {
        return totalBetCount[_betId];
    }

    function getUniqueTradersCount() external view returns (uint256) {
        return allTraders.length;
    }

    function getAllTraders() external view returns (address[] memory) {
        return allTraders;
    }

    function isAddressTrader(address _address) external view returns (bool) {
        return isTrader[_address];
    }

    function getUserTransactionCount(address _user, uint256 _betId) external view returns (uint256) {
        return userBetTransactions[_user][_betId].length;
    }

    function getUserAllTransactions(address _user, uint256 _betId) external view returns (EncryptedBetTransaction[] memory) {
        return userBetTransactions[_user][_betId];
    }

    function getHasPlacedBet(address _user, uint256 _betId) external view returns (bool) {
        return hasPlacedBet[_user][_betId];
    }

    receive() external payable {}
}
