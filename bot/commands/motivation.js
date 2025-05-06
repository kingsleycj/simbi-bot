const handleMotivation = (bot, chatId) => {
  const motivationalQuotes = [
    "🌟 Believe in yourself! You are capable of amazing things.",
    "🚀 Keep pushing forward. Success is just around the corner.",
    "💪 Every step you take brings you closer to your goals.",
    "📚 Your future is created by what you do today, not tomorrow.",
    "🧠 Knowledge is power. The more you learn, the more you grow.",
    "⏰ Time you enjoy wasting is not wasted time... but there's a limit, genius!",
    "🔥 The harder you work for something, the greater you'll feel when you achieve it.",
    "🏆 Success is the sum of small efforts repeated day in and day out.",
    "💡 The only way to learn something new is to try it first.",
    "🌈 The struggle you're in today is developing the strength you need for tomorrow."
  ];

  const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  
  // Send message with menu button options
  bot.sendMessage(
    chatId, 
    randomQuote,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Another Quote", callback_data: "motivation" },
            { text: "📚 Start Studying", callback_data: "study_session" }
          ],
          [
            { text: "🔙 Back to Menu", callback_data: "menu" }
          ]
        ]
      }
    }
  ).catch((error) => {
    console.error('Error sending motivation:', error);
  });
};

export { handleMotivation };