const users = {};  // Add this at the top level of your application if not already present
// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
require('dotenv').config();
const ethers = require('ethers');
const quizData = require('../../utils/quizQuestions.json');

console.log('Loaded Quiz Data:', quizData); // Debugging log

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
  // Check if user has a registered wallet
  if (!users[chatId]?.address) {
    bot.sendMessage(chatId, '❌ You need to register a wallet first! Use /start to create one.');
    return;
  }

  const category = data.split('_')[1];
  console.log(`Accessing category: "${category}"`);
  console.log('Category Data:', quizData[category]);

  if (!quizData[category]) {
    console.error(`Invalid category received: "${category}".`);
    console.error('Available Categories:', Object.keys(quizData));
    bot.sendMessage(chatId, `❌ Invalid category: "${category}". Please try again.`);
    return;
  }

  // Initialize or reset user progress when starting a new quiz
  users[chatId] = { 
    score: 0, 
    currentQuestionIndex: 0, 
    category 
  };

  const userProgress = users[chatId];
  const quizzes = quizData[category];

  if (!quizzes || quizzes.length === 0) {
    console.error(`No quizzes available for category: "${category}".`);
    bot.sendMessage(chatId, `❌ No quizzes available for category: "${category}". Please try again later.`);
    return;
  }

  // Get the current quiz question
  const quiz = quizzes[userProgress.currentQuestionIndex];

  if (!quiz || !quiz.question || !quiz.options || !Array.isArray(quiz.options)) {
    console.error(`Invalid quiz data at index ${userProgress.currentQuestionIndex} for category: "${category}".`);
    console.error('Quiz Data:', quiz);
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

  bot.sendMessage(
    chatId, 
    `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*\n\nQuestion ${userProgress.currentQuestionIndex + 1}/${quizzes.length}\n\n${quiz.question}`, 
    { parse_mode: 'Markdown', ...options }
  ).catch((error) => {
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
    bot.sendMessage(chatId, '🎉 Correct!')
      .then(() => {
        userProgress.score += 1;
        progressToNextQuestion(bot, users, chatId, category, quizzes);
      });
  } else {
    bot.sendMessage(chatId, '❌ Incorrect! Better luck next time.')
      .then(() => {
        progressToNextQuestion(bot, users, chatId, category, quizzes);
      });
  }
};

const progressToNextQuestion = (bot, users, chatId, category, quizzes) => {
  const userProgress = users[chatId];
  userProgress.currentQuestionIndex += 1;

  // Check if quiz is complete
  if (userProgress.currentQuestionIndex >= quizzes.length) {
    const finalScore = userProgress.score;
    const totalQuestions = quizzes.length;
    
    bot.sendMessage(
      chatId, 
      `🎉 Quiz Complete!\nYour final score: ${finalScore}/${totalQuestions}\n\n` +
      `${finalScore > 0 ? `🎁 You earned ${finalScore * 10} SIMBI tokens!` : '😅 Keep practicing to earn SIMBI tokens!'}\n\n` +
      'Use /menu to return to main menu'
    ).then(() => {
      // Reward tokens if user has scored points
      const userAddress = users[chatId]?.address;
      if (userAddress && finalScore > 0) {
        const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

        if (!SIMBIQUIZMANAGER_CA || !PRIVATE_KEY || !BASE_SEPOLIA_RPC_URL) {
          console.error('Missing environment variables for token rewards');
          bot.sendMessage(chatId, '⚠️ Could not process token rewards. Please contact support.');
          return;
        }

        console.log(`Rewarding ${finalScore * 10} SIMBI tokens to address ${userAddress}`);
        
        const quizManager = new ethers.Contract(
          SIMBIQUIZMANAGER_CA,
          ["function completeQuiz(address user, uint256 score) external"],
          new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL))
        );

        quizManager.completeQuiz(userAddress, finalScore * 10)
          .then(() => {
            bot.sendMessage(chatId, `✨ ${finalScore * 10} SIMBI tokens have been sent to your wallet!`);
          })
          .catch(error => {
            console.error('Error rewarding tokens:', error);
            bot.sendMessage(chatId, '⚠️ Failed to send tokens. Please try again later.');
          });
      }
      delete users[chatId]; // Reset user progress
    });
    return;
  }

  // Show next question
  const nextQuiz = quizzes[userProgress.currentQuestionIndex];
  const options = {
    reply_markup: {
      inline_keyboard: nextQuiz.options.map((option, index) => [
        { text: option, callback_data: `answer_${category}_${index}` }
      ])
    }
  };

  bot.sendMessage(
    chatId,
    `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*\n\n` +
    `Question ${userProgress.currentQuestionIndex + 1}/${quizzes.length}\n\n${nextQuiz.question}`,
    { parse_mode: 'Markdown', ...options }
  ).catch((error) => {
    console.error('Error sending next question:', error);
  });
};

module.exports = { handleQuizCommand, handleQuizCallback, handleAnswerCallback };