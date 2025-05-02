const handleProfileInfo = (bot, chatId) => {
  bot.sendMessage(chatId, '📄 Your profile is under construction. Stay tuned for updates!')
    .catch((error) => {
      console.error('Error sending profile info:', error);
    });
};

module.exports = { handleProfileInfo };