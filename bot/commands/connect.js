// This module handles the /connect command for connecting a custom wallet to the bot.
// It uses the ethers.js library to validate the private key and create a wallet instance.
import { ethers } from 'ethers';
import { encryptPrivateKey } from '../utils/encryption.js';

const handleConnectCommand = (bot, users, chatId, saveUsers) => {
  bot.sendMessage(chatId, '🔗 Please enter your custom wallet private key to connect:', { reply_markup: { force_reply: true } })
    .then((sentMessage) => {
      bot.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, (reply) => {
        const privateKey = reply.text.trim();

        try {
          const wallet = new ethers.Wallet(privateKey);
          // Encrypt the private key before storing
          const encryptedPrivateKey = encryptPrivateKey(privateKey);
          
          users[chatId] = { 
            address: wallet.address, 
            privateKey: encryptedPrivateKey, 
            createdAt: new Date().toISOString() 
          };
          
          saveUsers();

          // Confirm connection while hiding the private key
          bot.sendMessage(chatId, `✅ Your custom wallet has been successfully connected!

*Address:* \
\`${wallet.address}\`

Your private key has been securely encrypted and stored.`, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('Error connecting custom wallet:', error);
          bot.sendMessage(chatId, '❌ Invalid private key. Please try again.');
        }
      });
    })
    .catch((error) => console.error('Error handling /connect command:', error));
};

export { handleConnectCommand };