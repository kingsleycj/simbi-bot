const { ethers } = require('ethers');
const fs = require('fs');

const handleStartCommand = (bot, users, chatId, USERS_DB_FILE) => {
  if (users[chatId]) {
    bot.sendMessage(chatId, `👋 Welcome back!
Your SIMBI wallet address:

\
\`${users[chatId].address}\`

Use /menu to see available features.`, { parse_mode: 'Markdown' })
      .catch(error => console.error('Error sending welcome back message:', error));
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;

  users[chatId] = { address, privateKey, createdAt: new Date().toISOString() };
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2));

  bot.sendMessage(chatId, `🎉 *Your SIMBI Wallet has been created!*

*Address:* \
\`${address}\`
*Private Key:* \
\`${privateKey}\`

⚡ Save your private key safely!

Use /menu to explore all features.`, { parse_mode: 'Markdown' })
    .catch(error => console.error('Error sending wallet info:', error));
};

module.exports = { handleStartCommand };