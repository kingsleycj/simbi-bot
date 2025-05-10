// This module handles the /menu command in a Telegram bot.
// It sends a menu with various options to the user, including taking a quiz, checking wallet info, and more.
const handleMenuCommand = (bot, chatId) => {
  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎮 Take a Quiz", callback_data: 'quiz' }, // Updated to trigger category selection
          { text: "👛 Wallet Info", callback_data: 'wallet' }
        ],
        [
          { text: "📄 View Profile", callback_data: 'profile' },
          { text: "❓ Help", callback_data: 'help' }
        ],
        [
          { text: "⏰ Set Reminder", callback_data: 'reminder' },
          { text: "📊 Track Progress", callback_data: 'progress' }
        ],
        [
          { text: "🏅 View Achievements", callback_data: 'achievements' },
          { text: "💡 Motivation", callback_data: 'motivation' }
        ],
        [
          { text: "📚 Study Session", callback_data: 'study_session' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, '📋 *Main Menu*\n\nChoose an option below:', { parse_mode: 'Markdown', ...menuOptions })
    .catch(error => console.error('Error sending menu:', error));
};

export { handleMenuCommand };