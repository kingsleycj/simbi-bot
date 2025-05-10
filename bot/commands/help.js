import dotenv from 'dotenv';

dotenv.config();

// This module handles the /help command in the Telegram bot
// It provides instructions on how to use the bot and troubleshooting information for common issues

const handleHelpCommand = (bot, chatId) => {
  const helpText = `
📚 *SIMBI Bot Help Guide*

*Basic Commands:*
• /start - Create a wallet and begin your journey
• /menu - Show the main menu
• /quiz - Take a quiz to earn tokens
• /study_session - Start a focused study session
• /track_progress - View your learning progress
• /reset_study - Fix "in progress" study session issues
• /help - Show this help message

*Study Session Troubleshooting:*
If you see "You already have a study session in progress" but you're not studying:
1. Use the "Reset Study Session" option in the main menu
2. Or type /reset_study to force reset your session
3. Then start a new session

*NFT Badge Issues:*
If you don't see your earned NFT badges:
• Use the "Track Progress" option to refresh your data
• "No eligible tier" message is normal if you haven't completed enough study sessions yet
• Bronze tier requires 20+ sessions
• Silver tier requires 50+ sessions
• Gold tier requires 70+ sessions

*Wallet Connection:*
• Your wallet is created automatically on first use
• No need to connect external wallets
• All rewards are stored on the Base Sepolia testnet

*Need More Help?*
Contact the developer @kingsleycj for assistance
`;

  bot.sendMessage(chatId, helpText, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
    } 
  })
  .catch(error => console.error('Error sending help message:', error));
};

export { handleHelpCommand }; 