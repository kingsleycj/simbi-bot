const handleWalletInfo = (bot, chatId) => {
  bot.sendMessage(chatId, '👛 Your wallet is currently empty. Start earning SIMBI tokens by taking quizzes!')
    .catch((error) => {
      console.error('Error sending wallet info:', error);
    });
};

module.exports = { handleWalletInfo };