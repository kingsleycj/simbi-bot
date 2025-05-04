import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

// Define ABIs
const QUIZ_MANAGER_ABI = [
    "function completeQuiz(address user, uint256 score) external",
    "function isRegistered(address) external view returns (bool)",
    "function token() external view returns (address)",
    "function owner() external view returns (address)",
    "function registerWallet(address wallet) external",
    "function reRegisterWallet(address wallet) external",
    "function credentialIssued(address) external view returns (bool)",
    "function completedQuizzes(address) external view returns (uint256)",
    "function rewardPerQuiz() external view returns (uint256)"
];

const TOKEN_ABI = [
    "function mintToUser(address to, uint256 amount) public",
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function USER_SUPPLY_CAP() view returns (uint256)",
    "function minters(address) view returns (bool)",
    "function owner() view returns (address)",
    "function cap() view returns (uint256)",
    "function _userMinted() view returns (uint256)"
];

async function debugContracts() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log('\n=== Contract Debug ===');
        console.log('Bot Wallet:', botWallet.address);

        // Check QuizManager
        const quizManager = new ethers.Contract(
            process.env.SIMBIQUIZMANAGER_CA,
            QUIZ_MANAGER_ABI,
            botWallet
        );

        const tokenAddr = await quizManager.token();
        const owner = await quizManager.owner();
        console.log('\nQuizManager:');
        console.log('Address:', process.env.SIMBIQUIZMANAGER_CA);
        console.log('Owner:', owner);
        console.log('Token:', tokenAddr);

        // Check Token
        const token = new ethers.Contract(
            tokenAddr,
            TOKEN_ABI,
            botWallet
        );

        const totalSupply = await token.totalSupply();
        const userSupplyCap = await token.USER_SUPPLY_CAP();
        const isMinter = await token.minters(process.env.SIMBIQUIZMANAGER_CA);
        const tokenOwner = await token.owner();

        console.log('\nToken:');
        console.log('Address:', tokenAddr);
        console.log('Owner:', tokenOwner);
        console.log('Total Supply:', ethers.formatEther(totalSupply));
        console.log('User Supply Cap:', ethers.formatEther(userSupplyCap));
        console.log('QuizManager is Minter:', isMinter);

    } catch (error) {
        console.error('Debug failed:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            reason: error.reason,
            stack: error.stack
        });
    }
}

debugContracts();