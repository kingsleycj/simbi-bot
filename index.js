const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const { handleStartCommand } = require('./bot/commands/start');
const { handleMenuCommand } = require('./bot/commands/menu');
const { handleQuizCommand } = require('./bot/commands/quiz');
const { handleSyncCommand } = require('./bot/commands/sync');
const { handleConnectCommand } = require('./bot/commands/connect');
const { handleSetReminderCommand } = require('./bot/commands/reminder');
const { handleTrackProgressCommand, handleAchievementNFTs } = require('./bot/commands/trackProgress');

// Debug environment variables
console.log('Environment Variables:');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'Present' : 'Missing');
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT ? 'Present' : 'Missing');

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const USERS_DB_FILE = './users.json';

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

if (fs.existsSync(USERS_DB_FILE)) {
  const data = fs.readFileSync(USERS_DB_FILE);
  users = JSON.parse(data);
} else {
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2));
}

// === Save Users Function ===
function saveUsers() {
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2));
}

// Update command handlers
bot.onText(/\/start/, (msg) => handleStartCommand(bot, users, msg.chat.id.toString(), USERS_DB_FILE));
bot.onText(/\/menu/, (msg) => handleMenuCommand(bot, msg.chat.id.toString()));
bot.onText(/\/quiz/, (msg) => handleQuizCommand(bot, users, msg.chat.id.toString(), process.env.SIMBIQUIZMANAGER_CA, process.env.PRIVATE_KEY, process.env.BASE_SEPOLIA_RPC_URL));
bot.onText(/\/sync/, (msg) => handleSyncCommand(bot, users, msg.chat.id.toString(), saveUsers));
bot.onText(/\/connect/, (msg) => handleConnectCommand(bot, users, msg.chat.id.toString(), saveUsers));
bot.onText(/\/reminder/, (msg) => handleSetReminderCommand(bot, msg.chat.id.toString()));
bot.onText(/\/track_progress/, (msg) => handleTrackProgressCommand(bot, users, msg.chat.id.toString(), process.env.SIMBI_CONTRACT_ADDRESS, process.env.SIMBIBADGE_NFT_CA, process.env.BASE_SEPOLIA_RPC_URL));

// Handle unknown commands
bot.on('message', (msg) => {
  if (!msg.text.startsWith('/')) {
    bot.sendMessage(msg.chat.id, '❓ Unknown command. Use /menu to see available options.')
      .catch(error => console.error('Error sending unknown command message:', error));
  }
});

// Centralized callback_query handler
bot.on('callback_query', (query) => {
  bot.answerCallbackQuery(query.id).catch((error) => {
    console.error('Error answering callback query:', error);
  });

  const chatId = query.message.chat.id;
  const data = query.data;

  console.log('Callback Query Data:', data);

  try {
    if (data === 'quiz') {
      console.log('Triggering handleQuizCommand...');
      const { handleQuizCommand } = require('./bot/commands/quiz');
      handleQuizCommand(bot, users, chatId); // Trigger category selection
    } else if (data.startsWith('quiz_')) {
      console.log('Triggering handleQuizCallback...');
      const { handleQuizCallback } = require('./bot/commands/quiz');
      handleQuizCallback(bot, users, chatId, data);
    } else if (data.startsWith('answer_')) {
      console.log('Triggering handleAnswerCallback...');
      const { handleAnswerCallback } = require('./bot/commands/quiz');
      handleAnswerCallback(bot, users, chatId, data);
    } else if (data === 'wallet') {
      console.log('Triggering handleWalletInfo...');
      const { handleWalletInfo } = require('./bot/commands/wallet');
      handleWalletInfo(bot, chatId); // Handle wallet info
    } else if (data === 'profile') {
      console.log('Triggering handleProfileInfo...');
      const { handleProfileInfo } = require('./bot/commands/profile');
      handleProfileInfo(bot, chatId); // Handle profile info
    } else if (data === 'help') {
      console.log('Triggering handleHelpCommand...');
      const { handleHelpCommand } = require('./bot/commands/help');
      handleHelpCommand(bot, chatId); // Handle help command
    } else if (data === 'reminder') {
      console.log('Triggering handleSetReminderCommand...');
      const { handleSetReminderCommand } = require('./bot/commands/reminder');
      handleSetReminderCommand(bot, chatId); // Handle reminder
    } else if (data === 'progress') {
      console.log('Triggering handleTrackProgressCommand...');
      const { handleTrackProgressCommand } = require('./bot/commands/trackProgress');
      handleTrackProgressCommand(bot, users, chatId);
    } else if (data === 'achievements') {
      console.log('Triggering handleAchievementNFTs...');
      const { handleAchievementNFTs } = require('./bot/commands/trackProgress');
      handleAchievementNFTs(bot, users, chatId);
    } else if (data === 'motivation' || data === 'humor') {
      console.log('Triggering handlePersonalityResponse...');
      const { handlePersonalityResponse } = require('./bot/commands/menu');
      handlePersonalityResponse(bot, chatId, data);
    } else {
      console.log('Unknown action received:', data);
      bot.sendMessage(chatId, '❓ Unknown action. Please try again.');
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    bot.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
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

// === Start the Express Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webhook set to ${WEBHOOK_URL}${webhookPath}`);
});
