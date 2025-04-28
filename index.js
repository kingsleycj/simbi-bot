// index.js

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

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

// === Handle /start Command ===
const handleStartCommand = (msg) => {
  const chatId = msg.chat.id.toString();

  if (users[chatId]) {
    bot.sendMessage(chatId, `👋 Welcome back!\nYour SIMBI wallet address:\n\n\`${users[chatId].address}\`\n\nUse /menu to see available features.`, { parse_mode: 'Markdown' })
      .catch(error => console.error('Error sending welcome back message:', error));
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;

  users[chatId] = { address, privateKey, createdAt: new Date().toISOString() };
  saveUsers();

  bot.sendMessage(chatId, `🎉 *Your SIMBI Wallet has been created!*\n\n*Address:* \`${address}\`\n*Private Key:* \`${privateKey}\`\n\n⚡ Save your private key safely!\n\nUse /menu to explore all features.`, { parse_mode: 'Markdown' })
    .catch(error => console.error('Error sending wallet info:', error));
};

// === Handle /menu Command ===
const handleMenuCommand = (chatId) => {
  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎮 Take a Quiz", callback_data: 'quiz' },
          { text: "👛 Wallet Info", callback_data: 'wallet' }
        ],
        [
          { text: "📄 View Profile", callback_data: 'profile' },
          { text: "❓ Help", callback_data: 'help' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, '📋 *Main Menu*\n\nChoose an option below:', { parse_mode: 'Markdown', ...menuOptions })
    .catch(error => console.error('Error sending menu:', error));
};

// === Handle Callback Queries (Button Presses) ===
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Acknowledge the callback first
  bot.answerCallbackQuery(query.id)
    .catch(error => console.error('Error answering callback query:', error));

  switch (data) {
    case 'quiz':
      bot.sendMessage(chatId, '🎮 *Starting Quiz...*\n(Feature coming soon)', { parse_mode: 'Markdown' })
        .catch(error => console.error('Error sending quiz message:', error));
      break;

    case 'wallet':
      if (users[chatId]) {
        bot.sendMessage(chatId, `👛 *Your Wallet*\n\n*Address:* \`${users[chatId].address}\`\n*Private Key:* \`${users[chatId].privateKey}\``, { parse_mode: 'Markdown' })
          .catch(error => console.error('Error sending wallet info:', error));
      } else {
        bot.sendMessage(chatId, '❗ You have no wallet yet. Use /start to create one.')
          .catch(error => console.error('Error sending no wallet message:', error));
      }
      break;

    case 'profile':
      if (users[chatId]) {
        bot.sendMessage(chatId, `📄 *Your Profile*\n\n*Wallet Address:* \`${users[chatId].address}\`\n*Created On:* ${users[chatId].createdAt}`, { parse_mode: 'Markdown' })
          .catch(error => console.error('Error sending profile info:', error));
      } else {
        bot.sendMessage(chatId, '❗ No profile found. Use /start to create a profile.')
          .catch(error => console.error('Error sending no profile message:', error));
      }
      break;

    case 'help':
      bot.sendMessage(chatId, 'ℹ️ *Help Section*\n\nUse /start to create a wallet.\nUse /menu to see options.\nProtect your private key!\nMore features coming soon.', { parse_mode: 'Markdown' })
        .catch(error => console.error('Error sending help message:', error));
      break;

    default:
      bot.sendMessage(chatId, '❓ Unknown action.')
        .catch(error => console.error('Error sending unknown action message:', error));
  }
});

// Set up command handlers
bot.onText(/\/start/, handleStartCommand);
bot.onText(/\/menu/, (msg) => handleMenuCommand(msg.chat.id));

// Handle unknown commands
bot.on('message', (msg) => {
  if (!msg.text.startsWith('/')) {
    bot.sendMessage(msg.chat.id, '❓ Unknown command. Use /menu to see available options.')
      .catch(error => console.error('Error sending unknown command message:', error));
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
