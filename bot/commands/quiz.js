const users = {};  // Add this at the top level of your application if not already present
// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
require('dotenv').config();
const ethers = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const quizData = require('../../utils/quizQuestions.json');

// Path to users.json file
const USERS_FILE_PATH = path.join(__dirname, '../../../users.json');

// Check if users.json exists
(async () => {
  try {
    await fs.access(USERS_FILE_PATH);
    console.log('users.json found at:', USERS_FILE_PATH);
    
    // Log file contents
    const contents = await fs.readFile(USERS_FILE_PATH, 'utf8');
    console.log('Current users.json contents:', contents);
  } catch (error) {
    console.error('Error accessing users.json:', error);
  }
})();

console.log('Loaded Quiz Data:', quizData); // Debugging log

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIQUIZMANAGER_CA:', process.env.SIMBIQUIZMANAGER_CA);

// Load users data from file
async function loadUsers() {
  try {
    console.log('Attempting to load users from:', USERS_FILE_PATH);
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    const users = JSON.parse(data);
    console.log('Successfully loaded users:', users);
    return users;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('users.json file not found at:', USERS_FILE_PATH);
    } else {
      console.error('Error loading users:', error);
    }
    return {};
  }
}

// Save users data to file
async function saveUsers(users) {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

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

const handleQuizCallback = async (bot, users, chatId, data) => {
  try {
    const currentUsers = await loadUsers();
    console.log('Current users data:', currentUsers);
    console.log('Looking for chatId:', chatId);
    console.log('User wallet:', currentUsers[chatId]?.address);

    // Check if user exists and has a wallet
    if (!currentUsers[chatId] || !currentUsers[chatId].address) {
      console.log('No wallet found for user:', chatId);
      bot.sendMessage(chatId, '❌ You need to register a wallet first! Use /start to create one.');
      return;
    }

    // Update users object with loaded data
    users[chatId] = {
      ...currentUsers[chatId],
      score: 0,
      currentQuestionIndex: 0,
      category: data.split('_')[1]
    };

    // Save updated user data
    await saveUsers(users);

    const category = data.split('_')[1];
    console.log(`Accessing category: "${category}"`);
    console.log('Category Data:', quizData[category]);

    if (!quizData[category]) {
      console.error(`Invalid category received: "${category}".`);
      console.error('Available Categories:', Object.keys(quizData));
      bot.sendMessage(chatId, `❌ Invalid category: "${category}". Please try again.`);
      return;
    }

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
  } catch (error) {
    console.error('Error in handleQuizCallback:', error);
    bot.sendMessage(chatId, '❌ An error occurred while processing your request. Please try again later.');
  }
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

const progressToNextQuestion = async (bot, users, chatId, category, quizzes) => {
  const userProgress = users[chatId];
  userProgress.currentQuestionIndex += 1;

  if (userProgress.currentQuestionIndex >= quizzes.length) {
    const finalScore = userProgress.score;
    const totalQuestions = quizzes.length;
    
    try {
      // Get environment variables
      const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
      const PRIVATE_KEY = process.env.PRIVATE_KEY;
      const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

      // Verify environment variables
      if (!SIMBIQUIZMANAGER_CA || !PRIVATE_KEY || !BASE_SEPOLIA_RPC_URL) {
        throw new Error('Missing required environment variables');
      }

      const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
      const userAddress = users[chatId]?.address;
      
      // Check if user has a wallet
      if (!userAddress) {
        throw new Error('No wallet address found. Use /start to create one.');
      }

      // Check user's Base Sepolia ETH balance
      const balance = await provider.getBalance(userAddress);
      console.log(`User wallet balance: ${balance.toString()}`);
      
      if (balance === BigInt(0)) {
        bot.sendMessage(
          chatId,
          '⚠️ Your wallet needs Base Sepolia ETH for gas fees.\n' +
          'Get test ETH from: https://sepoliafaucet.com/\n' +
          'Then try another quiz!'
        );
        return;
      }

      // Initialize contract with proper ABI
      const quizManager = new ethers.Contract(
        SIMBIQUIZMANAGER_CA,
        [
          "function completeQuiz(address user, uint256 score) external",
          "function getWalletAddress(address user) external view returns (address)"
        ],
        provider
      );

      console.log('Tracked wallet:', trackedWallet);
      
      if (!trackedWallet) {
        throw new Error('Wallet not properly registered. Please use /start again.');
      }

      // Initialize wallet with private key
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      console.log('Bot wallet address:', wallet.address);

      // Send reward transaction
      const tx = await quizManager.connect(wallet).completeQuiz(
        userAddress,
        finalScore * 10,
        {
          gasLimit: 300000
        }
      );

      console.log('Transaction hash:', tx.hash);

      // Notify user about processing
      bot.sendMessage(
        chatId,
        `🎉 Quiz Complete!\n` +
        `Your final score: ${finalScore}/${totalQuestions}\n\n` +
        `🎁 Processing ${finalScore * 10} SIMBI tokens...\n` +
        `Transaction: https://sepolia.basescan.org/tx/${tx.hash}\n\n` +
        `Use /menu to return to main menu`
      );

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction receipt:', receipt);

      if (receipt.status === 1) {
        bot.sendMessage(
          chatId,
          `✅ Tokens sent successfully!\n` +
          `Received: ${finalScore * 10} SIMBI\n` +
          `View: https://sepolia.basescan.org/tx/${receipt.hash}`
        );
      }

    } catch (error) {
      console.error('Token reward error:', error);
      bot.sendMessage(
        chatId,
        `⚠️ Error processing token reward:\n${error.message}\n\n` +
        `Make sure you:\n` +
        `1. Have a registered wallet (/start)\n` +
        `2. Have Base Sepolia ETH for gas\n` +
        `3. Try another quiz later`
      );
    }

    delete users[chatId];
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