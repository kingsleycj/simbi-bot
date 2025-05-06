import dotenv from 'dotenv';

dotenv.config();

const handleHelpCommand = async (bot, chatId) => {
  try {
    const helpText = `
🔍 *SIMBI Bot Help Guide*

*General Commands:*
• /start - Register your wallet and get started
• /menu - Show main menu with all options
• /help - Display this help guide

*Study Tools:*
• /study_session - Start a focused study session
• /quiz - Take a quiz to test your knowledge
• /reminder - Set up study reminders

*Progress Tracking:*
• /track_progress - View your on-chain progress
• /profile - See your user profile
• /wallet - Check your SIMBI token balance

*Tips for Success:*
• Complete daily quizzes to earn SIMBI tokens
• Finish study sessions to earn rewards
• Collect NFT badges for study milestones
• Use reminders to maintain a consistent schedule

*Help & Support:*
• For technical issues: support@simbiproject.com
• To learn more: https://simbiproject.com
`;

    await bot.sendMessage(
      chatId,
      helpText,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  } catch (error) {
    console.error('Error handling help command:', error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

export { handleHelpCommand }; 