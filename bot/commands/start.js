import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Initialize dotenv and setup __dirname equivalent
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add proper ABI for contract interaction
const QUIZ_MANAGER_ABI = [
  "function registerWallet(address wallet) external",
  "function isRegistered(address) external view returns (bool)",
  "function owner() external view returns (address)"
];

export const handleStartCommand = async (bot, users, chatId, msg) => {
    try {
        // Check if user already has a wallet
        if (users[chatId] && users[chatId].address) {
            const existingWallet = users[chatId];
            const message = 
                '❗ You already have a wallet registered:\n\n' +
                `Address: \`${existingWallet.address}\`\n\n` +
                '🎮 Use /menu to continue interacting with SimbiBot!\n' +
                '⚠️ If you need to recover your private key, please contact support.';

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return;
        }

        // Create new wallet
        const wallet = ethers.Wallet.createRandom();
        console.log('New wallet created:', wallet.address);

        // Debug contract interaction
        console.log('\n=== Contract Interaction Debug ===');
        console.log('Contract Address:', process.env.SIMBIQUIZMANAGER_CA);
        console.log('New Wallet:', wallet.address);
        console.log('Bot Wallet:', new ethers.Wallet(process.env.PRIVATE_KEY).address);

        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const quizManager = new ethers.Contract(
            process.env.SIMBIQUIZMANAGER_CA,
            QUIZ_MANAGER_ABI,
            botWallet
        );

        // Check if contract is accessible
        const owner = await quizManager.owner();
        console.log('Contract Owner:', owner);

        // Register wallet with explicit transaction parameters
        const tx = await quizManager.registerWallet(wallet.address, {
            gasLimit: 500000,
            maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
        });

        console.log('Registration Tx Hash:', tx.hash);
        const receipt = await tx.wait();
        
        if (receipt.status !== 1) {
            throw new Error('Registration transaction failed');
        }

        // Verify registration
        const isRegistered = await quizManager.isRegistered(wallet.address);
        if (!isRegistered) {
            throw new Error('Wallet registration verification failed');
        }

        // Extract user information from message
        const firstName = msg?.from?.first_name || "";
        const lastName = msg?.from?.last_name || "";
        const username = msg?.from?.username || "";

        // Update users object
        users[chatId] = {
            address: wallet.address,
            privateKey: wallet.privateKey,
            createdAt: new Date().toISOString(),
            isRegistered: true,
            firstName,
            lastName,
            username,
            balance: 0,
            tokens: [],
            studySessions: {
                completed: 0,
                ongoing: null,
                history: []
            },
            completedQuizzes: 0
        };

        // Save to users.json
        await fs.writeFile(
            path.join(process.cwd(), 'users.json'),
            JSON.stringify(users, null, 2)
        );

        // Send welcome message with transaction info
        const welcomeMessage = 
            '🎉 Welcome to SimbiBot!\n\n' +
            '🔐 Your new wallet has been created and registered:\n' +
            `Address: \`${wallet.address}\`\n\n` +
            '⚠️ Important: Save your private key securely!\n' +
            `Private Key: \`${wallet.privateKey}\`\n\n` +
            `Registration tx: https://sepolia.basescan.org/tx/${tx.hash}\n\n` +
            '🎮 Use /menu to start interacting with SimbiBot!';

        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Contract interaction error:', {
            message: error.message,
            code: error.code,
            reason: error.reason,
            transaction: error?.transaction
        });
        await bot.sendMessage(
            chatId,
            '❌ Error creating wallet. Please try again later.'
        );
    }
};