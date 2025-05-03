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

export const handleStartCommand = async (bot, users, chatId) => {
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

        // Create new wallet only for new users
        const wallet = ethers.Wallet.createRandom();
        console.log('New wallet created:', wallet.address);

        // Update users object with new wallet
        users[chatId] = {
            address: wallet.address,
            privateKey: wallet.privateKey,
            createdAt: new Date().toISOString()  // Add creation timestamp
        };

        // Save to users.json using async fs
        const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');
        await fs.writeFile(
            USERS_FILE_PATH,
            JSON.stringify(users, null, 2),
            'utf8'
        );

        // Send welcome message for new users
        const welcomeMessage = 
            '🎉 Welcome to SimbiBot!\n\n' +
            '🔐 Your new wallet has been created:\n' +
            `Address: \`${wallet.address}\`\n\n` +
            '⚠️ Important: Save your private key securely!\n' +
            `Private Key: \`${wallet.privateKey}\`\n\n` +
            '🎮 Use /menu to start interacting with SimbiBot!';

        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        console.log('Wallet created and saved for user:', chatId);

    } catch (error) {
        console.error('Error in handleStartCommand:', error);
        await bot.sendMessage(
            chatId,
            '❌ Error creating wallet. Please try again later.'
        );
    }
};