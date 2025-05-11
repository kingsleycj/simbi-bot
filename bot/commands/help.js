import dotenv from 'dotenv';

dotenv.config();

// This module handles the /help command in the Telegram bot
// It provides instructions on how to use the bot and troubleshooting information for common issues

const handleHelpCommand = async (bot, chatId) => {
  console.log(`Executing help command for chat ID: ${chatId}`);
  
  try {
    const helpText = `
📚 *SIMBI Bot Help Guide*

*Basic Commands:*
• /start - Create a wallet and begin your journey
• /menu - Show the main menu
• /quiz - Take a quiz to earn tokens
• /study_session - Start a focused study session
• /track_progress - View your learning progress
• /reset_study - Fix "in progress" study session issues
• /chat - Chat with Simbi AI about study tips
• /help - Show this help message

*Study Session Troubleshooting:*
If you see "You already have a study session in progress" but you're not studying:
1. Use the "Reset Study Session" button directly on the Study Session screen
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

    // First try sending with Markdown
    await bot.sendMessage(chatId, helpText, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
      } 
    });
    
    console.log(`Help message sent successfully to chat ID: ${chatId}`);
  } catch (error) {
    console.error(`Error sending help message to chat ID: ${chatId}:`, error);
    
    // If Markdown fails, try plain text as fallback
    try {
      const plainHelpText = `
📚 *SIMBI Bot Help Guide*

*Basic Commands:*
• /start - Create a wallet and begin your journey
• /menu - Show the main menu
• /quiz - Take a quiz to earn tokens
• /study_session - Start a focused study session
• /track_progress - View your learning progress
• /reset_study - Fix "in progress" study session issues
• /chat - Chat with Simbi AI about study tips
• /help - Show this help message

*Study Session Troubleshooting:*
If you see "You already have a study session in progress" but you're not studying:
1. Use the "Reset Study Session" button directly on the Study Session screen
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
      
      await bot.sendMessage(chatId, plainHelpText, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      });
      
      console.log(`Fallback plain help message sent to chat ID: ${chatId}`);
    } catch (fallbackError) {
      console.error('Even fallback help message failed:', fallbackError);
    }
  }
};

export { handleHelpCommand }; 