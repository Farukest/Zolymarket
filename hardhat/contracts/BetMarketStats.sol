// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./BetMarketCore.sol";

contract BetMarketStats is SepoliaConfig {
    BetMarketCore public core;
    address public owner;

    mapping(uint256 => uint256) public betDecryptionRequests;
    mapping(uint256 => bool) public isBetStatsDecrypted;

    event BetStatisticsDecrypted(uint256 indexed betId, uint256 indexed requestId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address payable _coreContract) {
        require(_coreContract != address(0), "Core address zero");
        core = BetMarketCore(_coreContract);
        owner = msg.sender;
    }

    function requestBetStatistics(uint256 _betId) external onlyOwner {
        (uint256 id, uint256 endTime, , , BetMarketCore.BetType betType, , , , uint256 optionCount, , , , ) = core.bets(_betId);

        require(id != 0, "Bet does not exist");
        require(block.timestamp >= endTime, "Bet not ended");
        require(!isBetStatsDecrypted[_betId], "Already decrypted");

        bytes32[] memory cts;

        if (betType == BetMarketCore.BetType.NESTED_CHOICE) {
            cts = new bytes32[](optionCount * 2 + 1);
            uint256 idx = 0;

            for (uint256 i = 0; i < optionCount; i++) {
                cts[idx++] = FHE.toBytes32(core.getNestedOptionEncryptedTotal(_betId, i, 0));
                cts[idx++] = FHE.toBytes32(core.getNestedOptionEncryptedTotal(_betId, i, 1));
            }

            cts[idx] = FHE.toBytes32(core.getTotalPoolEncrypted(_betId));
        } else {
            cts = new bytes32[](optionCount + 1);

            for (uint256 i = 0; i < optionCount; i++) {
                cts[i] = FHE.toBytes32(core.getOptionEncryptedTotal(_betId, i));
            }

            cts[optionCount] = FHE.toBytes32(core.getTotalPoolEncrypted(_betId));
        }

        uint256 requestId = FHE.requestDecryption(cts, this.callbackBetStatistics.selector);
        betDecryptionRequests[_betId] = requestId;
    }

    function callbackBetStatistics(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        uint256 betId = 0;
        uint256 nextBetId = core.getTotalBets() + 1;
        for (uint256 i = 1; i < nextBetId; i++) {
            if (betDecryptionRequests[i] == requestId) {
                betId = i;
                break;
            }
        }
        require(betId != 0, "Invalid request");

        (,,,, BetMarketCore.BetType betType, , , , uint256 optionCount, , , , ) = core.bets(betId);

        if (betType == BetMarketCore.BetType.NESTED_CHOICE) {
            if (optionCount == 2) {
                (uint64 opt0Yes, uint64 opt0No, uint64 opt1Yes, uint64 opt1No, ) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64));
                core.updatePublicShares(betId, 0, opt0Yes + opt0No, opt0Yes, opt0No);
                core.updatePublicShares(betId, 1, opt1Yes + opt1No, opt1Yes, opt1No);
            } else if (optionCount == 3) {
                (uint64 opt0Yes, uint64 opt0No, uint64 opt1Yes, uint64 opt1No, uint64 opt2Yes, uint64 opt2No, ) =
                    abi.decode(cleartexts, (uint64, uint64, uint64, uint64, uint64, uint64, uint64));
                core.updatePublicShares(betId, 0, opt0Yes + opt0No, opt0Yes, opt0No);
                core.updatePublicShares(betId, 1, opt1Yes + opt1No, opt1Yes, opt1No);
                core.updatePublicShares(betId, 2, opt2Yes + opt2No, opt2Yes, opt2No);
            }
        } else {
            if (optionCount == 2) {
                (uint64 opt0, uint64 opt1, ) = abi.decode(cleartexts, (uint64, uint64, uint64));
                core.updatePublicShares(betId, 0, opt0, 0, 0);
                core.updatePublicShares(betId, 1, opt1, 0, 0);
            } else if (optionCount == 3) {
                (uint64 opt0, uint64 opt1, uint64 opt2, ) = abi.decode(cleartexts, (uint64, uint64, uint64, uint64));
                core.updatePublicShares(betId, 0, opt0, 0, 0);
                core.updatePublicShares(betId, 1, opt1, 0, 0);
                core.updatePublicShares(betId, 2, opt2, 0, 0);
            }
        }

        isBetStatsDecrypted[betId] = true;
        emit BetStatisticsDecrypted(betId, requestId);
    }

    function getBetStatistics(uint256 _betId) external view returns (
        uint256[] memory optionTotalsDecrypted,
        bool isDecrypted
    ) {
        (uint256 id, , , , , , , , uint256 optionCount, , , , ) = core.bets(_betId);
        require(id != 0, "Bet does not exist");

        optionTotalsDecrypted = new uint256[](optionCount);

        for (uint256 i = 0; i < optionCount; i++) {
            BetMarketCore.BetOption memory option = core.getBetOption(_betId, i);
            optionTotalsDecrypted[i] = option.publicTotalShares;
        }

        return (optionTotalsDecrypted, isBetStatsDecrypted[_betId]);
    }

    function getNestedBetStatistics(uint256 _betId) external view returns (
        uint256[] memory yesShares,
        uint256[] memory noShares,
        bool isDecrypted
    ) {
        (uint256 id, , , , BetMarketCore.BetType betType, , , , uint256 optionCount, , , , ) = core.bets(_betId);
        require(id != 0, "Bet does not exist");
        require(betType == BetMarketCore.BetType.NESTED_CHOICE, "Not a nested bet");

        yesShares = new uint256[](optionCount);
        noShares = new uint256[](optionCount);

        for (uint256 i = 0; i < optionCount; i++) {
            BetMarketCore.BetOption memory option = core.getBetOption(_betId, i);
            yesShares[i] = option.publicYesShares;
            noShares[i] = option.publicNoShares;
        }

        return (yesShares, noShares, isBetStatsDecrypted[_betId]);
    }
}
