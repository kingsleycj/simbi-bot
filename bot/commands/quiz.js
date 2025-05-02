// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
require('dotenv').config();
const { ethers } = require('ethers');
const quizData = require('../../utils/quizQuestions.json');

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIQUIZMANAGER_CA:', process.env.SIMBIQUIZMANAGER_CA);

const handleQuizCommand = (bot, chatId) => {
  const categories = Object.keys(quizData);

  if (categories.length === 0) {
    bot.sendMessage(chatId, '❌ No quiz categories available. Please try again later.');
    return;
  }

  const options = {
    reply_markup: {
      inline_keyboard: categories.map((category) => [
        { text: category.charAt(0).toUpperCase() + category.slice(1), callback_data: `quiz_${category}` }
      ])
    }
  };

  bot.sendMessage(chatId, '📝 *Choose a Quiz Category:*', { parse_mode: 'Markdown', ...options })
    .catch((error) => console.error('Error sending quiz categories:', error));
};

const handleQuizCallback = (bot, users, chatId, data) => {
  const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

  if (!SIMBIQUIZMANAGER_CA || !PRIVATE_KEY || !BASE_SEPOLIA_RPC_URL) {
    console.error('One or more environment variables are not defined or invalid.');
    bot.sendMessage(chatId, '⚠️ Configuration error: Missing contract addresses or RPC URL. Please contact support.');
    return;
  }

  const category = data.split('_')[1]; // Extract category from callback_data
  const quizzes = quizData[category];

  if (!quizzes) {
    bot.sendMessage(chatId, `❌ Invalid category: "${category}". Please try again.`);
    return;
  }

  const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];

  const options = {
    reply_markup: {
      inline_keyboard: quiz.options.map((option, index) => [
        { text: option, callback_data: `answer_${category}_${index}` }
      ])
    }
  };

  bot.sendMessage(chatId, `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*\n\n${quiz.question}`, { parse_mode: 'Markdown', ...options })
    .catch((error) => console.error('Error sending quiz question:', error));

  bot.once('callback_query', (answerQuery) => {
    const selectedOptionIndex = parseInt(answerQuery.data.split('_')[2]);
    const selectedOption = quiz.options[selectedOptionIndex];

    if (selectedOption === quiz.answer) {
      bot.sendMessage(chatId, '🎉 Correct! You earned 10 SIMBI tokens!');

      const userAddress = users[chatId]?.address;
      if (userAddress) {
        const quizManager = new ethers.Contract(
          SIMBIQUIZMANAGER_CA,
          ["function completeQuiz(address user, uint256 score) external"],
          new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL))
        );

        quizManager.completeQuiz(userAddress, 100).catch((error) => {
          console.error('Error rewarding tokens:', error);
          bot.sendMessage(chatId, '⚠️ Failed to reward tokens. Please try again later.');
        });
      }
    } else {
      bot.sendMessage(chatId, '❌ Incorrect! Better luck next time.');
    }

    bot.answerCallbackQuery(answerQuery.id).catch((error) => console.error('Error answering callback query:', error));
  });
};

module.exports = { handleQuizCommand, handleQuizCallback };