// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BetMarketCore.sol";

contract BetMarketPayout is SepoliaConfig, ReentrancyGuard {
    // Reference to Core contract
    BetMarketCore public core;

    struct PayoutInfo {
        address user;
        uint256 betId;
        uint256 payout;
        bool processed;
    }

    mapping(uint256 => PayoutInfo) public pendingPayouts;
    mapping(address => mapping(uint256 => uint256)) public userPayoutRequests;
    mapping(address => mapping(uint256 => bool)) public hasRequestedPayout;

    event PayoutRequested(uint256 indexed betId, address indexed user, uint256 indexed requestId);
    event PayoutCalculated(uint256 indexed requestId, address indexed user, uint256 indexed betId, uint256 payout);
    event PayoutReady(uint256 indexed betId, address indexed user, uint256 amount);
    event WinningsClaimed(uint256 indexed betId, address indexed user, uint256 amount);

    constructor(address payable _coreContract) {
        require(_coreContract != address(0), "Core address zero");
        core = BetMarketCore(_coreContract);
    }

    function requestPayout(uint256 _betId) external nonReentrant {
        (uint256 id, uint256 endTime, bool isActive, bool isResolved, BetMarketCore.BetType betType, , , , uint256 optionCount, , , , ) = core.bets(_betId);

        require(id != 0, "Bet does not exist");
        require(isResolved, "Bet not resolved");
        require(core.hasPlacedBet(msg.sender, _betId), "No bet placed");
        require(!core.hasClaimed(msg.sender, _betId), "Already claimed");
        require(!hasRequestedPayout[msg.sender][_betId], "Payout already requested");

        bytes32[] memory cts;

        if (betType == BetMarketCore.BetType.BINARY || betType == BetMarketCore.BetType.MULTIPLE_CHOICE) {
            cts = new bytes32[](optionCount * 2 + 1);
            uint256 idx = 0;

            for (uint256 i = 0; i < optionCount; i++) {
                cts[idx++] = FHE.toBytes32(core.getUserEncryptedBetAmount(msg.sender, _betId, i));
            }

            cts[idx++] = FHE.toBytes32(core.getTotalPoolEncrypted(_betId));

            for (uint256 i = 0; i < optionCount; i++) {
                cts[idx++] = FHE.toBytes32(core.getOptionEncryptedTotal(_betId, i));
            }
        } else {
            cts = new bytes32[](optionCount * 4 + 1);
            uint256 idx = 0;

            for (uint256 i = 0; i < optionCount; i++) {
                cts[idx++] = FHE.toBytes32(core.getUserNestedBetAmount(msg.sender, _betId, i, 0));
                cts[idx++] = FHE.toBytes32(core.getUserNestedBetAmount(msg.sender, _betId, i, 1));
            }

            cts[idx++] = FHE.toBytes32(core.getTotalPoolEncrypted(_betId));

            for (uint256 i = 0; i < optionCount; i++) {
                cts[idx++] = FHE.toBytes32(core.getNestedOptionEncryptedTotal(_betId, i, 0));
                cts[idx++] = FHE.toBytes32(core.getNestedOptionEncryptedTotal(_betId, i, 1));
            }
        }

        uint256 requestId = FHE.requestDecryption(cts, this.callbackPayout.selector);

        hasRequestedPayout[msg.sender][_betId] = true;
        userPayoutRequests[msg.sender][_betId] = requestId;

        pendingPayouts[requestId] = PayoutInfo({
            user: msg.sender,
            betId: _betId,
            payout: 0,
            processed: false
        });

        emit PayoutRequested(_betId, msg.sender, requestId);
    }

    function callbackPayout(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        PayoutInfo storage payoutInfo = pendingPayouts[requestId];
        require(payoutInfo.user != address(0), "Invalid request");
        require(!payoutInfo.processed, "Already processed");

        uint256 betId = payoutInfo.betId;
        address user = payoutInfo.user;

        (,,,, BetMarketCore.BetType betType, , , , uint256 optionCount, , , , ) = core.bets(betId);

        uint256 totalPayout = 0;

        if (betType == BetMarketCore.BetType.BINARY || betType == BetMarketCore.BetType.MULTIPLE_CHOICE) {
            uint256 winnerIndex = type(uint256).max;
            for (uint256 i = 0; i < optionCount; i++) {
                BetMarketCore.BetOption memory option = core.getBetOption(betId, i);
                if (option.isWinner) {
                    winnerIndex = i;
                    break;
                }
            }
            require(winnerIndex != type(uint256).max, "No winner set");

            if (optionCount == 2) {
                (uint64 user0, uint64 user1, uint64 pool, uint64 total0, uint64 total1) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(pool) - liquidityAmount;

                uint64 userAmount = (winnerIndex == 0) ? user0 : user1;
                uint64 winnerTotal = (winnerIndex == 0) ? total0 : total1;

                if (userAmount > 0 && winnerTotal > 0) {
                    totalPayout = (uint256(userAmount) * actualPool) / uint256(winnerTotal);
                }
            } else if (optionCount == 3) {
                (uint64 user0, uint64 user1, uint64 user2, uint64 pool, uint64 total0, uint64 total1, uint64 total2) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(pool) - liquidityAmount;

                uint64 userAmount = (winnerIndex == 0) ? user0 : (winnerIndex == 1) ? user1 : user2;
                uint64 winnerTotal = (winnerIndex == 0) ? total0 : (winnerIndex == 1) ? total1 : total2;

                if (userAmount > 0 && winnerTotal > 0) {
                    totalPayout = (uint256(userAmount) * actualPool) / uint256(winnerTotal);
                }
            } else if (optionCount == 5) {
                // Support for 5 options BINARY/MULTIPLE_CHOICE bets
                (uint64 user0, uint64 user1, uint64 user2, uint64 user3, uint64 user4,
                    uint64 pool,
                    uint64 total0, uint64 total1, uint64 total2, uint64 total3, uint64 total4) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(pool) - liquidityAmount;

                uint64 userAmount;
                uint64 winnerTotal;

                if (winnerIndex == 0) {
                    userAmount = user0;
                    winnerTotal = total0;
                } else if (winnerIndex == 1) {
                    userAmount = user1;
                    winnerTotal = total1;
                } else if (winnerIndex == 2) {
                    userAmount = user2;
                    winnerTotal = total2;
                } else if (winnerIndex == 3) {
                    userAmount = user3;
                    winnerTotal = total3;
                } else {
                    userAmount = user4;
                    winnerTotal = total4;
                }

                if (userAmount > 0 && winnerTotal > 0) {
                    totalPayout = (uint256(userAmount) * actualPool) / uint256(winnerTotal);
                }
            }
        } else {
            if (optionCount == 2) {
                (uint64 user0Yes, uint64 user0No, uint64 user1Yes, uint64 user1No,
                    uint64 totalPool, uint64 total0Yes, uint64 total0No, uint64 total1Yes, uint64 total1No) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(totalPool) - liquidityAmount;

                for (uint256 i = 0; i < optionCount; i++) {
                    BetMarketCore.BetOption memory option = core.getBetOption(betId, i);
                    if (option.isWinner) {
                        uint64 userYes = (i == 0) ? user0Yes : user1Yes;
                        uint64 userNo = (i == 0) ? user0No : user1No;
                        uint64 totalYes = (i == 0) ? total0Yes : total1Yes;
                        uint64 totalNo = (i == 0) ? total0No : total1No;

                        if (userYes > 0 && totalYes > 0) {
                            totalPayout += (uint256(userYes) * actualPool) / uint256(totalYes);
                        }
                        if (userNo > 0 && totalNo > 0) {
                            totalPayout += (uint256(userNo) * actualPool) / uint256(totalNo);
                        }
                        break;
                    }
                }
            } else if (optionCount == 3) {
                (uint64 user0Yes, uint64 user0No, uint64 user1Yes, uint64 user1No, uint64 user2Yes, uint64 user2No,
                    uint64 totalPool, uint64 total0Yes, uint64 total0No, uint64 total1Yes, uint64 total1No, uint64 total2Yes, uint64 total2No) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(totalPool) - liquidityAmount;

                for (uint256 i = 0; i < optionCount; i++) {
                    BetMarketCore.BetOption memory option = core.getBetOption(betId, i);
                    if (option.isWinner) {
                        uint64 userYes = (i == 0) ? user0Yes : (i == 1) ? user1Yes : user2Yes;
                        uint64 userNo = (i == 0) ? user0No : (i == 1) ? user1No : user2No;
                        uint64 totalYes = (i == 0) ? total0Yes : (i == 1) ? total1Yes : total2Yes;
                        uint64 totalNo = (i == 0) ? total0No : (i == 1) ? total1No : total2No;

                        if (userYes > 0 && totalYes > 0) {
                            totalPayout += (uint256(userYes) * actualPool) / uint256(totalYes);
                        }
                        if (userNo > 0 && totalNo > 0) {
                            totalPayout += (uint256(userNo) * actualPool) / uint256(totalNo);
                        }
                        break;
                    }
                }
            } else if (optionCount == 5) {
                // Support for 5 options (like bet 2: NYC Mayoral Election)
                (uint64 user0Yes, uint64 user0No, uint64 user1Yes, uint64 user1No, uint64 user2Yes, uint64 user2No,
                    uint64 user3Yes, uint64 user3No, uint64 user4Yes, uint64 user4No,
                    uint64 totalPool,
                    uint64 total0Yes, uint64 total0No, uint64 total1Yes, uint64 total1No, uint64 total2Yes, uint64 total2No,
                    uint64 total3Yes, uint64 total3No, uint64 total4Yes, uint64 total4No) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64, uint64));

                // Subtract liquidity from pool before distributing to winners
                uint256 liquidityParam = core.getBet(betId).liquidityParam;
                uint256 liquidityAmount = liquidityParam * 1e6;
                uint256 actualPool = uint256(totalPool) - liquidityAmount;

                for (uint256 i = 0; i < optionCount; i++) {
                    BetMarketCore.BetOption memory option = core.getBetOption(betId, i);
                    if (option.isWinner) {
                        uint64 userYes;
                        uint64 userNo;
                        uint64 totalYes;
                        uint64 totalNo;

                        if (i == 0) {
                            userYes = user0Yes; userNo = user0No;
                            totalYes = total0Yes; totalNo = total0No;
                        } else if (i == 1) {
                            userYes = user1Yes; userNo = user1No;
                            totalYes = total1Yes; totalNo = total1No;
                        } else if (i == 2) {
                            userYes = user2Yes; userNo = user2No;
                            totalYes = total2Yes; totalNo = total2No;
                        } else if (i == 3) {
                            userYes = user3Yes; userNo = user3No;
                            totalYes = total3Yes; totalNo = total3No;
                        } else {
                            userYes = user4Yes; userNo = user4No;
                            totalYes = total4Yes; totalNo = total4No;
                        }

                        if (userYes > 0 && totalYes > 0) {
                            totalPayout += (uint256(userYes) * actualPool) / uint256(totalYes);
                        }
                        if (userNo > 0 && totalNo > 0) {
                            totalPayout += (uint256(userNo) * actualPool) / uint256(totalNo);
                        }
                        break;
                    }
                }
            }
        }

        payoutInfo.payout = totalPayout;
        payoutInfo.processed = true;

        emit PayoutCalculated(requestId, user, betId, totalPayout);
        emit PayoutReady(betId, user, totalPayout);
    }

    function claimPayout(uint256 _betId) external nonReentrant {
        // Check if user has requested payout (requestId can be 0, which is valid)
        require(hasRequestedPayout[msg.sender][_betId], "No payout request found");

        uint256 requestId = userPayoutRequests[msg.sender][_betId];
        PayoutInfo memory payoutInfo = pendingPayouts[requestId];

        require(payoutInfo.user == msg.sender, "Not your payout");
        require(payoutInfo.processed, "Payout not ready yet");
        require(!core.hasClaimed(msg.sender, _betId), "Already claimed");
        require(payoutInfo.payout > 0, "No winnings");

        core.setHasClaimed(msg.sender, _betId);
        core.addToUserBalance(msg.sender, payoutInfo.payout);

        delete pendingPayouts[requestId];
        delete userPayoutRequests[msg.sender][_betId];

        emit WinningsClaimed(_betId, msg.sender, payoutInfo.payout);
    }

    function getPayoutStatus(uint256 _betId, address _user) external view returns (
        bool hasRequested,
        bool isProcessed,
        uint256 payoutAmount
    ) {
        // ✅ Check hasRequestedPayout mapping (persistent even after claim)
        bool requested = hasRequestedPayout[_user][_betId];
        if (!requested) {
            return (false, false, 0);
        }

        // Get request details
        uint256 requestId = userPayoutRequests[_user][_betId];

        // ✅ Check if payout info exists in pendingPayouts
        PayoutInfo memory info = pendingPayouts[requestId];

        // If user address is 0, mapping was deleted (user already claimed)
        if (info.user == address(0)) {
            return (true, true, 0); // hasRequested=true, isProcessed=true, amount=0 (already claimed)
        }

        return (true, info.processed, info.payout);
    }
}
