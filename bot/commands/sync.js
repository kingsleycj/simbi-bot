const handleSyncCommand = (bot, users, chatId, saveUsers) => {
  bot.sendMessage(chatId, '🔗 Please enter your web app user ID to sync your account:', { reply_markup: { force_reply: true } })
    .then((sentMessage) => {
      bot.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, (reply) => {
        const userId = reply.text.trim();

        if (userId) {
          users[chatId] = { ...users[chatId], webAppUserId: userId };
          saveUsers();

          bot.sendMessage(chatId, `✅ Your Telegram account has been successfully synced with your web app account (User ID: ${userId}).`);
        } else {
          bot.sendMessage(chatId, '❌ Invalid User ID. Please try again.');
        }
      });
    })
    .catch((error) => console.error('Error handling /sync command:', error));
};

module.exports = { handleSyncCommand };