// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimbiToken.sol";
import "./SimbiBadgeNFT.sol";
import "./SimbiCredentialNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimbiQuizManager is Ownable {
    SimbiToken public token;
    SimbiBadgeNFT public badgeNFT;
    SimbiCredentialNFT public credentialNFT;

    uint256 public rewardPerQuiz = 10 * (10 ** 18); // 10 SIMBI per quiz
    mapping(address => uint256) public completedQuizzes;
    mapping(address => bool) public credentialIssued;

    constructor(
        address tokenAddress,
        address badgeAddress,
        address credentialAddress
    ) Ownable(msg.sender) {
        token = SimbiToken(tokenAddress);
        badgeNFT = SimbiBadgeNFT(badgeAddress);
        credentialNFT = SimbiCredentialNFT(credentialAddress);
    }

    function completeQuiz(address user, uint256 score) external onlyOwner {
        completedQuizzes[user]++;

        // Reward tokens
        token.mint(user, rewardPerQuiz);

        // Record quiz attempt for badge eligibility
        badgeNFT.recordQuizAttempt(user, score);

        // Try to mint highest eligible badge
        try badgeNFT.getEligibleTier(user) returns (SimbiBadgeNFT.BadgeTier tier) {
            badgeNFT.safeMint(user, tier);
        } catch {
            // No eligible tier, continue
        }

        // Issue Credential NFT (soulbound) after 10 quizzes
        if (completedQuizzes[user] == 10 && !credentialIssued[user]) {
            credentialNFT.safeMint(user, "ipfs://bafkreiam74mj26do4if5zu6lwq2p4igadhxrspamlnmzzksmzgyrpunylq/");
            credentialIssued[user] = true;
        }
    }
}
