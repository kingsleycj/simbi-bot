const handleMotivation = (bot, chatId) => {
  const motivationalQuotes = [
    "🌟 Believe in yourself! You are capable of amazing things.",
    "🚀 Keep pushing forward. Success is just around the corner.",
    "💪 Every step you take brings you closer to your goals."
  ];

  const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  bot.sendMessage(chatId, randomQuote)
    .catch((error) => {
      console.error('Error sending motivation:', error);
    });
};

module.exports = { handleMotivation };