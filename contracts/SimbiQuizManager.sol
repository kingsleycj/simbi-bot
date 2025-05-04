// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimbiToken.sol";
import "./SimbiBadgeNFT.sol";
import "./SimbiCredentialNFT.sol";

contract SimbiQuizManager {
    address public owner;
    SimbiToken public token;
    SimbiBadgeNFT public badgeNFT;
    SimbiCredentialNFT public credentialNFT;

    uint256 public rewardPerQuiz = 10 * (10 ** 18); // 10 SIMBI per quiz
    mapping(address => uint256) public completedQuizzes;
    mapping(address => bool) public credentialIssued;
    mapping(address => bool) public isRegistered;
    mapping(address => uint256) public quizScores;

    event WalletRegistered(address indexed wallet);
    event QuizCompleted(address indexed user, uint256 score);

    constructor(
        address tokenAddress,
        address badgeAddress,
        address credentialAddress
    ) {
        owner = msg.sender;
        token = SimbiToken(tokenAddress);
        badgeNFT = SimbiBadgeNFT(badgeAddress);
        credentialNFT = SimbiCredentialNFT(credentialAddress);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Function to register a wallet
    function registerWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "Invalid wallet address");
        require(!isRegistered[wallet], "Wallet already registered");
        
        isRegistered[wallet] = true;
        emit WalletRegistered(wallet);
    }

    // Function to complete a quiz
    function completeQuiz(address user, uint256 score) external onlyOwner {
        require(isRegistered[user], "Wallet not registered");
        completedQuizzes[user]++;
        quizScores[user] += score;
        emit QuizCompleted(user, score);

        // Reward tokens (using mintToUser for quiz rewards)
        token.mintToUser(user, rewardPerQuiz);

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

    // Function to update reward amount (only owner)
    function setRewardPerQuiz(uint256 newReward) external onlyOwner {
        rewardPerQuiz = newReward;
    }

    // Function to verify registration
    function verifyRegistration(address wallet) external view returns (bool) {
        return isRegistered[wallet];
    }

    // Function to re-register a wallet
    function reRegisterWallet(address wallet) external onlyOwner {
        isRegistered[wallet] = true;
        emit WalletRegistered(wallet);
    }
}
