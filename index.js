import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { loadUsers, saveUsers, getAllUsers, saveUser } from './bot/db-adapter.js';

// Initialize dotenv
dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import commands
import { handleStartCommand } from './bot/commands/start.js';
import { handleMenuCommand } from './bot/commands/menu.js';
import { handleQuizCommand, handleQuizCallback, handleAnswerCallback } from './bot/commands/quiz.js';
import { handleSyncCommand } from './bot/commands/sync.js';
import { handleConnectCommand } from './bot/commands/connect.js';
import { handleSetReminderCommand, handleListReminders, handleCancelReminder } from './bot/commands/reminder.js';
import { handleTrackProgressCommand, handleAchievementNFTs, handleShareProgress, mintNFTBadge } from './bot/commands/trackProgress.js';
import { handleWalletInfo } from './bot/commands/wallet.js';
import { handleProfileInfo } from './bot/commands/profile.js';
import { handleMotivation } from './bot/commands/motivation.js';
import { handleStudySessionCommand, handleStudySessionCallback, handleCancelStudySession, handleResetStudySession } from './bot/commands/study_session.js';
import { handleHelpCommand } from './bot/commands/help.js';
import { handleChatCommand, handleChatMessage } from './bot/commands/chat.js';

// Debug environment variables
console.log('Environment Variables:');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'Present' : 'Missing');
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT ? 'Present' : 'Missing');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Present' : 'Missing');

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize Telegram Bot with webhook (no polling)
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Set Webhook URL
const webhookPath = '/webhook';
bot.setWebHook(`${WEBHOOK_URL}${webhookPath}`)
  .then(() => {
    console.log('Webhook set successfully');
  })
  .catch((error) => {
    console.error('Error setting webhook:', error);
  });

// === Load or Initialize User Database ===
let users = {};

// Initialize users on startup
(async () => {
  users = await loadUsers();
})();

// Make sure all chat IDs are consistently strings when used for accessing user data
function ensureUserConsistency() {
  try {
    // Convert all numeric chat IDs to strings in the users object
    const numericKeys = Object.keys(users).filter(key => !isNaN(key));
    
    if (numericKeys.length > 0) {
      console.log(`Converting ${numericKeys.length} numeric chat ID keys to strings...`);
      
      numericKeys.forEach(numericKey => {
        const stringKey = numericKey.toString();
        
        // If the string version doesn't already exist, copy the data
        if (!users[stringKey] && users[numericKey]) {
          users[stringKey] = users[numericKey];
          console.log(`Converted ${numericKey} → ${stringKey}`);
          
          // Clean up the numeric version to avoid duplication
          delete users[numericKey];
        }
      });
      
      // Save the updated users object
      saveUsers(users);
    }
  } catch (error) {
    console.error('Error ensuring user data consistency:', error);
  }
}

// Call this before setting up command handlers
ensureUserConsistency();

// Update command handlers to use saveUsers function from db-adapter
bot.onText(/\/start/, (msg) => handleStartCommand(bot, users, msg.chat.id.toString(), msg));
bot.onText(/\/menu/, (msg) => handleMenuCommand(bot, msg.chat.id.toString()));
bot.onText(/\/quiz/, (msg) => handleQuizCommand(bot, users, msg.chat.id.toString(), process.env.SIMBIQUIZMANAGER_CA, process.env.PRIVATE_KEY, process.env.BASE_SEPOLIA_RPC_URL));
bot.onText(/\/sync/, (msg) => handleSyncCommand(bot, users, msg.chat.id.toString(), saveUsers));
bot.onText(/\/connect/, (msg) => handleConnectCommand(bot, users, msg.chat.id.toString(), saveUsers));
bot.onText(/\/reminder/, (msg) => handleSetReminderCommand(bot, msg.chat.id.toString()));
bot.onText(/\/track_progress/, (msg) => handleTrackProgressCommand(bot, users, msg.chat.id.toString(), process.env.SIMBIBADGE_NFT_CA, process.env.BASE_SEPOLIA_RPC_URL));
bot.onText(/\/study_session/, (msg) => handleStudySessionCommand(bot, users, msg.chat.id.toString()));
bot.onText(/\/reset_study/, (msg) => handleResetStudySession(bot, users, msg.chat.id.toString()));
bot.onText(/\/help/, (msg) => handleHelpCommand(bot, msg.chat.id.toString()));
bot.onText(/\/profile/, (msg) => handleProfileInfo(bot, msg.chat.id.toString(), msg));
bot.onText(/\/chat/, (msg) => handleChatCommand(bot, msg.chat.id.toString(), users));

// Handle regular messages (for chat feature and other interactions)
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) {
    return; // Skip command messages or messages without text
  }
  
  // Get the chat ID as string for consistency
  const chatId = msg.chat.id.toString();
  
  // Debug logging
  console.log(`Received message: "${msg.text}" from chat ID: ${chatId}`);
  console.log(`Reply to message: ${msg.reply_to_message ? 'Yes' : 'No'}`);
  
  // Create a user context for chat if it doesn't exist
  if (!users[chatId]) {
    users[chatId] = {};
    saveUser(chatId, users[chatId]);
  }
  
  // Track if we've handled this message
  let messageHandled = false;
  
  // Check if this is a reply to a bot message
  if (msg.reply_to_message) {
    const replyText = msg.reply_to_message.text || '';
    console.log(`Reply to text: "${replyText.substring(0, 30)}..."`);
    
    // Handle chat with Simbi replies - check for multiple possible phrases
    if (
      replyText.includes("I'm SIMBI, your AI study buddy") || 
      replyText.includes("Chat with SIMBI") ||
      replyText.includes("What would you like to ask me")
    ) {
      console.log('Handling as chat message');
      handleChatMessage(bot, chatId, msg, users);
      messageHandled = true;
      return;
    }
    
    // Handle reminder time setting
    if (replyText.includes("Please enter the time for your reminder")) {
      console.log('Message is a reply to reminder setup - letting onReplyToMessage handle it');
      messageHandled = true;
      return; // Let the onReplyToMessage handler in reminder.js handle this
    }
    
    // Add other reply handlers here if needed
  }
  
  // Check if we should treat this as a chat message even without a reply
  // This helps when users just continue typing without explicitly replying
  if (!messageHandled && users[chatId].inChatMode) {
    console.log('User is in chat mode, handling as chat message');
    handleChatMessage(bot, chatId, msg, users);
    return;
  }
  
  // If we get here, it's an unprompted message that's not a command
  console.log('Sending unknown command message');
  bot.sendMessage(chatId, '❓ Unknown command. Use /menu to see available options.')
    .catch(error => console.error('Error sending unknown command message:', error));
});

// Centralized callback_query handler
bot.on('callback_query', async (query) => {
  bot.answerCallbackQuery(query.id).catch((error) => {
    console.error('Error answering callback query:', error);
  });

  const chatId = query.message.chat.id.toString(); // Ensure chatId is a string
  const data = query.data;

  console.log('Callback Query Data:', data);
  console.log(`Callback from chatId: ${chatId} (type: ${typeof chatId})`);
  
  // Reload users data from file to ensure fresh data
  try {
    const freshUsers = await loadUsers();
    
    // If user exists in file but not in memory, update memory
    if (freshUsers[chatId] && !users[chatId]) {
      users[chatId] = freshUsers[chatId];
      console.log('Updated in-memory user data from file for chatId:', chatId);
    }
  } catch (err) {
    console.error('Error reloading users data:', err);
  }
  
  console.log(`User data exists: ${!!users[chatId]}`);

  try {
    if (data === 'menu') {
      console.log('Triggering handleMenuCommand...');
      // Reset chat mode when returning to menu
      if (users[chatId]) {
        users[chatId].inChatMode = false;
        console.log(`Reset chat mode for user ${chatId}`);
      }
      handleMenuCommand(bot, chatId);
    } else if (data === 'quiz') {
      console.log('Triggering handleQuizCommand...');
      handleQuizCommand(bot, users, chatId);
    } else if (data.startsWith('quiz_')) {
      console.log('Triggering handleQuizCallback...');
      handleQuizCallback(bot, users, chatId, data);
    } else if (data.startsWith('answer_')) {
      console.log('Triggering handleAnswerCallback...');
      handleAnswerCallback(bot, users, chatId, data);
    } else if (data === 'wallet') {
      console.log('Triggering handleWalletInfo...');
      handleWalletInfo(bot, chatId);
    } else if (data === 'profile') {
      console.log('Triggering handleProfileInfo...');
      handleProfileInfo(bot, chatId, query.message);
    } else if (data === 'help' || data === 'show_help') {
      console.log('Triggering handleHelpCommand...');
      try {
        await handleHelpCommand(bot, chatId);
        console.log('Help command executed successfully');
      } catch (helpError) {
        console.error('Error executing help command:', helpError);
        bot.sendMessage(
          chatId,
          "⚠️ Error displaying help. Please try /help command directly.",
          {
            reply_markup: {
              inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
            }
          }
        ).catch(msgError => console.error('Error sending help error message:', msgError));
      }
    } else if (data === 'start_wallet') {
      console.log('Redirecting to wallet creation...');
      bot.sendMessage(
        chatId,
        "To create a new wallet, please use the /start command.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    } else if (data === 'reminder') {
      console.log('Triggering handleSetReminderCommand...');
      handleSetReminderCommand(bot, chatId);
    } else if (data === 'list_reminders') {
      console.log('Triggering handleListReminders...');
      handleListReminders(bot, chatId);
    } else if (data === 'cancel_reminder') {
      console.log('Triggering handleCancelReminder...');
      handleCancelReminder(bot, chatId);
    } else if (data === 'progress') {
      console.log('Triggering handleTrackProgressCommand...');
      handleTrackProgressCommand(bot, users, chatId);
    } else if (data === 'achievements') {
      console.log('Triggering handleAchievementNFTs...');
      handleAchievementNFTs(bot, users, chatId);
    } else if (data === 'share_progress') {
      console.log('Triggering handleShareProgress...');
      handleShareProgress(bot, users, chatId);
    } else if (data.startsWith('mint_badge_')) {
      console.log('Triggering mintNFTBadge...');
      const tier = parseInt(data.split('_')[2]);
      mintNFTBadge(bot, users, chatId, tier);
    } else if (data === 'motivation') {
      console.log('Triggering handleMotivation...');
      handleMotivation(bot, chatId);
    } else if (data === 'study_session') {
      console.log('Triggering handleStudySessionCommand...');
      handleStudySessionCommand(bot, users, chatId);
    } else if (data.startsWith('study_')) {
      console.log('Triggering handleStudySessionCallback...');
      console.log('Users object available:', !!users);
      console.log('Chat ID type:', typeof chatId);
      console.log('Chat ID:', chatId);
      console.log('Users keys:', Object.keys(users));
      handleStudySessionCallback(bot, users, chatId, data);
    } else if (data === 'cancel_study') {
      console.log('Triggering handleCancelStudySession...');
      handleCancelStudySession(bot, users, chatId);
    } else if (data === 'reset_study') {
      console.log('Triggering handleResetStudySession...');
      handleResetStudySession(bot, users, chatId);
    } else if (data === 'chat') {
      console.log('Triggering handleChatCommand...');
      handleChatCommand(bot, chatId, users);
    } else {
      console.log('Unknown action received:', data);
      bot.sendMessage(
        chatId, 
        '❓ Unknown action. Please try again.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    bot.sendMessage(
      chatId, 
      '⚠️ An error occurred. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
});

// === Handle Incoming Webhook Updates ===
app.post(webhookPath, (req, res) => {
  try {
    console.log('Received webhook update:', JSON.stringify(req.body, null, 2));
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing update:', error);
    res.sendStatus(500);
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

// Add process error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// === Start the Express Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webhook set to ${WEBHOOK_URL}${webhookPath}`);
});
