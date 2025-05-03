import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

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
import { handleSetReminderCommand } from './bot/commands/reminder.js';
import { handleTrackProgressCommand, handleAchievementNFTs } from './bot/commands/trackProgress.js';
import { handleWalletInfo } from './bot/commands/wallet.js';
import { handleProfileInfo } from './bot/commands/profile.js';
// import { handleHelpCommand } from './bot/commands/help.js';
import { handleMotivation } from './bot/commands/motivation.js';
import { handleHumor } from './bot/commands/humor.js';

// Debug environment variables
console.log('Environment Variables:');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'Present' : 'Missing');
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT ? 'Present' : 'Missing');

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const USERS_DB_FILE = './users.json';

async function initializeUsersFile() {
  const usersPath = path.join(__dirname, 'users.json');
  try {
    await fs.access(usersPath);
    const data = await fs.readFile(usersPath, 'utf8');
    try {
      JSON.parse(data);
    } catch (e) {
      console.log('Invalid JSON in users.json, recreating...');
      await fs.writeFile(usersPath, '{}', 'utf8');
    }
  } catch (error) {
    console.log('Creating new users.json file...');
    await fs.writeFile(usersPath, '{}', 'utf8');
  }
}

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize Telegram Bot with webhook (no polling)
await initializeUsersFile();
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

try {
  const data = await fs.readFile(USERS_DB_FILE, 'utf8');
  users = JSON.parse(data);
} catch (error) {
  if (error.code === 'ENOENT') {
    await fs.writeFile(USERS_DB_FILE, JSON.stringify(users, null, 2));
  } else {
    console.error('Error loading users:', error);
  }
}

// === Save Users Function ===
async function saveUsers() {
  await fs.writeFile(USERS_DB_FILE, JSON.stringify(users, null, 2));
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
      handleProfileInfo(bot, chatId); // Handle profile info
    } else if (data === 'help') {
      console.log('Triggering handleHelpCommand...');
      handleHelpCommand(bot, chatId); // Handle help command
    } else if (data === 'reminder') {
      console.log('Triggering handleSetReminderCommand...');
      handleSetReminderCommand(bot, chatId); // Handle reminder
    } else if (data === 'progress') {
      console.log('Triggering handleTrackProgressCommand...');
      handleTrackProgressCommand(bot, users, chatId);
    } else if (data === 'achievements') {
      console.log('Triggering handleAchievementNFTs...');
      handleAchievementNFTs(bot, users, chatId);
    } else if (data === 'motivation') {
      console.log('Triggering handleMotivation...');
      handleMotivation(bot, chatId);
    } else if (data === 'humor') {
      console.log('Triggering handleHumor...');
      handleHumor(bot, chatId);
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
