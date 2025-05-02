// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
require('dotenv').config();
const ethers = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const quizData = require('../../utils/quizQuestions.json');

// Update the QUIZ_MANAGER_ABI to include all necessary functions
const QUIZ_MANAGER_ABI = [
  "function completeQuiz(address user, uint256 score) external",
  "function getWalletAddress(address user) external view returns (address)",
  "function owner() external view returns (address)",
  "function token() external view returns (address)",
  "function badgeNFT() external view returns (address)"
];

// Add this helper function at the top of the file
async function verifyContractState(provider, contractAddress, userAddress) {
  const quizManager = new ethers.Contract(
    contractAddress,
    QUIZ_MANAGER_ABI,
    provider
  );

  console.log('Verifying contract state...');

  try {
    const owner = await quizManager.owner();
    console.log('Contract owner:', owner);

    const token = await quizManager.token();
    console.log('Token contract:', token);

    const badgeNFT = await quizManager.badgeNFT();
    console.log('Badge NFT contract:', badgeNFT);

    // Check if user is registered
    const registeredWallet = await quizManager.getWalletAddress(userAddress);
    console.log('Registered wallet for user:', registeredWallet);

    if (registeredWallet.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error('User wallet not properly registered');
    }

    return true;
  } catch (error) {
    console.error('Contract verification failed:', error);
    return false;
  }
}

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

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

      // Add this check before sending the transaction
      const isContractValid = await verifyContractState(provider, SIMBIQUIZMANAGER_CA, userAddress);
      if (!isContractValid) {
        throw new Error('Contract verification failed');
      }

      try {
        // Initialize contract with proper ABI and signer
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        
        console.log('Initializing contract interaction...');
        console.log('Contract address:', SIMBIQUIZMANAGER_CA);
        console.log('User address:', userAddress);
        console.log('Bot wallet address:', wallet.address);

        // Create interface for function encoding
        const quizManagerInterface = new ethers.Interface(QUIZ_MANAGER_ABI);
        
        // Encode the function call
        const data = quizManagerInterface.encodeFunctionData("completeQuiz", [
          userAddress,
          finalScore * 10
        ]);
        
        console.log('Encoded transaction data:', data);

        // Create and send the transaction
        const tx = await wallet.sendTransaction({
          to: SIMBIQUIZMANAGER_CA,
          data: data,
          gasLimit: 500000
        });

        console.log('Transaction hash:', tx.hash);
        
        await bot.sendMessage(
          chatId,
          `🎉 Quiz Complete!\n` +
          `Your final score: ${finalScore}/${totalQuestions}\n\n` +
          `🎁 Processing ${finalScore * 10} SIMBI tokens...\n` +
          `Transaction: https://sepolia.basescan.org/tx/${tx.hash}\n\n` +
          `Use /menu to return to main menu`
        );

        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          tx.wait(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), 60000)
          )
        ]);

        if (receipt.status === 1) {
          await bot.sendMessage(
            chatId,
            `✅ Tokens sent successfully!\n` +
            `Received: ${finalScore * 10} SIMBI\n` +
            `View: https://sepolia.basescan.org/tx/${receipt.hash}`
          );
        } else {
          throw new Error('Transaction failed');
        }

      } catch (error) {
        console.error('Contract interaction error:', error);
        
        // More detailed error message
        const errorMessage = error.reason || error.message || 'Unknown error';
        throw new Error(`Transaction failed: ${errorMessage} (${error.code || 'NO_CODE'})`);
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