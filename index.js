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

  if (data === 'quiz') {
    const { handleQuizCommand } = require('./bot/commands/quiz');
    handleQuizCommand(bot, chatId); // Trigger category selection
  } else if (data.startsWith('quiz_')) {
    const { handleQuizCallback } = require('./bot/commands/quiz');
    handleQuizCallback(bot, users, chatId, data);
  } else if (data === 'achievements') {
    const { handleAchievementNFTs } = require('./bot/commands/trackProgress');
    handleAchievementNFTs(bot, users, chatId);
  } else if (data === 'motivation' || data === 'humor') {
    const { handlePersonalityResponse } = require('./bot/commands/menu');
    handlePersonalityResponse(bot, chatId, data);
  } else if (data === 'wallet') {
    bot.sendMessage(chatId, '👛 Wallet Info: This feature is under development.');
  } else if (data === 'progress') {
    const { handleTrackProgressCommand } = require('./bot/commands/trackProgress');
    handleTrackProgressCommand(bot, users, chatId);
  } else if (data === 'profile') {
    bot.sendMessage(chatId, '📄 Profile Info: This feature is under development.');
  } else if (data === 'help') {
    bot.sendMessage(chatId, '❓ Help: Use the menu to navigate through available options.');
  } else if (data === 'reminder') {
    bot.sendMessage(chatId, '⏰ Reminder: This feature is under development.');
  } else {
    bot.sendMessage(chatId, '❓ Unknown action. Please try again.');
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
