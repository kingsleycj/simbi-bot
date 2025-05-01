const { ethers } = require('ethers');

const handleConnectCommand = (bot, users, chatId, saveUsers) => {
  bot.sendMessage(chatId, '🔗 Please enter your custom wallet private key to connect:', { reply_markup: { force_reply: true } })
    .then((sentMessage) => {
      bot.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, (reply) => {
        const privateKey = reply.text.trim();

        try {
          const wallet = new ethers.Wallet(privateKey);
          users[chatId] = { address: wallet.address, privateKey, createdAt: new Date().toISOString() };
          saveUsers();

          bot.sendMessage(chatId, `✅ Your custom wallet has been successfully connected!

*Address:* \
\`${wallet.address}\``, { parse_mode: 'Markdown' });
        } catch (error) {
          console.error('Error connecting custom wallet:', error);
          bot.sendMessage(chatId, '❌ Invalid private key. Please try again.');
        }
      });
    })
    .catch((error) => console.error('Error handling /connect command:', error));
};

module.exports = { handleConnectCommand };