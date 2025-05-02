// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
require('dotenv').config();
const ethers = require('ethers');
const quizData = require('../../utils/quizQuestions.json');

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIQUIZMANAGER_CA:', process.env.SIMBIQUIZMANAGER_CA);

const handleQuizCommand = (bot, users, chatId) => {
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
    .catch((error) => {
      console.error('Error:', error.message, error.stack);
      console.error('Error sending quiz categories:', error);
    });
};

const handleQuizCallback = (bot, users, chatId, data) => {
  const category = data.split('_')[1];

  if (!quizData[category]) {
    console.error(`Invalid category received: "${category}".`);
    bot.sendMessage(chatId, `❌ Invalid category: "${category}". Please try again.`);
    return;
  }

  if (!users[chatId]) {
    console.log(`Initializing user progress for chatId: ${chatId}`);
    users[chatId] = { score: 0, currentQuestionIndex: 0, category };
  }

  const userProgress = users[chatId];
  const quizzes = quizData[category];

  // Debugging logs
  console.log('User Progress:', userProgress);
  console.log('Quizzes:', quizzes);

  if (!quizzes || quizzes.length === 0) {
    console.error(`No quizzes available for category: "${category}".`);
    bot.sendMessage(chatId, `❌ No quizzes available for category: "${category}". Please try again later.`);
    return;
  }

  if (userProgress.currentQuestionIndex >= quizzes.length) {
    console.log(`Quiz completed for chatId: ${chatId}. Score: ${userProgress.score}`);
    bot.sendMessage(chatId, `🎉 Quiz Complete! Your score: ${userProgress.score}/${quizzes.length}`);

    // Tokenization logic: Reward the user with SIMBI tokens
    const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    if (SIMBIQUIZMANAGER_CA && PRIVATE_KEY && BASE_SEPOLIA_RPC_URL) {
      const userAddress = users[chatId]?.address;
      if (userAddress) {
        const quizManager = new ethers.Contract(
          SIMBIQUIZMANAGER_CA,
          ["function completeQuiz(address user, uint256 score) external"],
          new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL))
        );

        quizManager.completeQuiz(userAddress, userProgress.score * 10).catch((error) => {
          console.error('Error rewarding tokens:', error);
          bot.sendMessage(chatId, '⚠️ Failed to reward tokens. Please try again later.');
        });
      }
    }

    delete users[chatId];
    return;
  }

  const quiz = quizzes[userProgress.currentQuestionIndex];

  if (!quiz || !quiz.options) {
    console.error(`Invalid quiz data at index ${userProgress.currentQuestionIndex} for category: "${category}".`);
    bot.sendMessage(chatId, `❌ Invalid quiz data. Please try again later.`);
    return;
  }

  const options = {
    reply_markup: {
      inline_keyboard: quiz.options.map((option, index) => [
        { text: option, callback_data: `answer_${category}_${index}` }
      ])
    }
  };

  bot.sendMessage(chatId, `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*\n\n${quiz.question}`, { parse_mode: 'Markdown', ...options })
    .catch((error) => {
      console.error('Error sending quiz question:', error);
    });
};

const handleAnswerCallback = (bot, users, chatId, data) => {
  const [_, category, selectedOptionIndex] = data.split('_');
  const userProgress = users[chatId];
  const quizzes = quizData[category];

  if (!userProgress || !quizzes) {
    bot.sendMessage(chatId, '❓ Unknown action. Please try again.');
    return;
  }

  const quiz = quizzes[userProgress.currentQuestionIndex];
  const selectedOption = quiz.options[parseInt(selectedOptionIndex)];

  if (selectedOption === quiz.answer) {
    bot.sendMessage(chatId, '🎉 Correct!');
    userProgress.score += 1;
  } else {
    bot.sendMessage(chatId, '❌ Incorrect! Better luck next time.');
  }

  userProgress.currentQuestionIndex += 1; // Move to the next question
  handleQuizCallback(bot, users, chatId, `quiz_${category}`); // Send the next question
};

module.exports = { handleQuizCommand, handleQuizCallback, handleAnswerCallback };