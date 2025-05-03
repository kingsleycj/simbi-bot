// This file handles the quiz command and its callback for a Telegram bot using Telegraf.js.
// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const quizData = require('../../utils/quizQuestions.json');

// Initialize dotenv
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Update QUIZ_MANAGER_ABI to ensure it matches the contract
const QUIZ_MANAGER_ABI = [
  "function completeQuiz(address user, uint256 score) external",
  "function getWalletAddress(address user) external view returns (address)",
  "function owner() external view returns (address)",
  "function token() external view returns (address)",
  "function badgeNFT() external view returns (address)",
  "function isRegistered(address user) external view returns (bool)",
  "function registerWallet(address wallet) external",
  "function completedQuizzes(address) external view returns (uint256)",
  "function credentialIssued(address) external view returns (bool)"
];

// Add this debug function at the top after imports
async function checkWalletRegistration(provider, contractAddress, userAddress) {
  try {
    const quizManager = new ethers.Contract(
      contractAddress,
      QUIZ_MANAGER_ABI,
      provider
    );

    console.log('\n=== Wallet Registration Check ===');
    console.log('Contract:', contractAddress);
    console.log('User:', userAddress);

    // First verify contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('Contract not deployed at specified address');
    }

    // Check owner to verify contract
    const owner = await quizManager.owner();
    console.log('Contract owner:', owner);

    // Check if wallet is registered
    const isRegistered = await quizManager.isRegistered(userAddress);
    console.log('Is registered:', isRegistered);

    return isRegistered;
  } catch (error) {
    console.error('Wallet registration check failed:', {
      message: error.message,
      code: error.code,
      transaction: error.transaction
    });
    return false;
  }
}

// Add this helper function at the top of the file
async function verifyContractState(provider, contractAddress, userAddress) {
  try {
    console.log('\n=== Contract Verification Debug ===');
    console.log('Starting contract verification...');
    console.log('Contract address:', contractAddress);
    console.log('User address:', userAddress);

    const quizManager = new ethers.Contract(
      contractAddress,
      QUIZ_MANAGER_ABI,
      provider
    );

    // Add this check
    const isRegistered = await quizManager.isRegistered(userAddress);
    console.log('Is wallet registered?', isRegistered);

    // Check registration status
    const registeredWallet = await quizManager.getWalletAddress(userAddress);
    console.log('Registered wallet address:', registeredWallet);
    console.log('Expected wallet address:', userAddress);
    console.log('Match?', registeredWallet.toLowerCase() === userAddress.toLowerCase());
    console.log('================================\n');

    // Verify contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('Contract not deployed at specified address');
    }

    console.log('Verifying contract state...');

    // Check contract owner
    const owner = await quizManager.owner();
    console.log('Contract owner:', owner);

    // Check token contract
    const token = await quizManager.token();
    console.log('Token contract:', token);

    // Check badge NFT contract
    const badgeNFT = await quizManager.badgeNFT();
    console.log('Badge NFT contract:', badgeNFT);

    // Additional validation
    if (!registeredWallet || registeredWallet === '0x0000000000000000000000000000000000000000') {
      throw new Error('User wallet not registered in contract');
    }

    if (registeredWallet.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error(`Wallet mismatch. Registered: ${registeredWallet}, User: ${userAddress}`);
    }

    console.log('Contract verification successful');
    return true;

  } catch (error) {
    console.error('Contract verification failed:', {
      error: error.message,
      code: error.code,
      reason: error.reason,
      wallet: userAddress
    });
    return false;
  }
}

// Add this function to verify environment variables
const verifyEnvironment = () => {
  const required = [
    'BASE_SEPOLIA_RPC_URL',
    'SIMBIQUIZMANAGER_CA',
    'PRIVATE_KEY',
    'SIMBI_CONTRACT_ADDRESS'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

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

// Update the loadUsers function
async function loadUsers() {
  try {
    console.log('Attempting to load users from:', USERS_FILE_PATH);
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    
    // Handle empty file case
    if (!data.trim()) {
      console.log('users.json is empty, initializing with empty object');
      await fs.writeFile(USERS_FILE_PATH, '{}');
      return {};
    }

    const users = JSON.parse(data);
    console.log('Successfully loaded users:', users);
    return users;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('users.json not found, creating new file');
      await fs.writeFile(USERS_FILE_PATH, '{}');
      return {};
    }
    
    if (error instanceof SyntaxError) {
      console.log('Invalid JSON in users.json, resetting file');
      await fs.writeFile(USERS_FILE_PATH, '{}');
      return {};
    }
    
    console.error('Error loading users:', error);
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

// Update the handleQuizCallback function
const handleQuizCallback = async (bot, users, chatId, data) => {
  try {
    const currentUsers = await loadUsers();
    console.log('\n=== Quiz Start Debug ===');
    console.log('Current users data:', currentUsers);
    console.log('Chat ID:', chatId);

    if (!currentUsers[chatId]) {
      console.log('No user data found');
      bot.sendMessage(chatId, '❌ Please use /start first to create your wallet.');
      return;
    }

    const userAddress = currentUsers[chatId].address;
    console.log('User wallet address:', userAddress);

    // Check wallet registration
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const isRegistered = await checkWalletRegistration(
      provider,
      process.env.SIMBIQUIZMANAGER_CA,
      userAddress
    );

    if (!isRegistered) {
      console.log('Wallet not registered, initiating registration...');
      await handleReregister(bot, chatId);
      return;
    }

    // Continue with quiz if wallet is registered
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
    bot.sendMessage(
      chatId,
      '❌ An error occurred. Please try using /start to create a new wallet.'
    );
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
      verifyEnvironment();

      const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
      const userAddress = users[chatId]?.address;
      
      // Check if user has a wallet
      if (!userAddress) {
        throw new Error('No wallet address found. Use /start to create one.');
      }

      // Verify contract state with detailed error handling
      console.log('Verifying contract state before transaction...');
      const isContractValid = await verifyContractState(provider, SIMBIQUIZMANAGER_CA, userAddress);
      
      if (!isContractValid) {
        const users = await loadUsers();
        const userData = users[chatId];
        console.log('Current user data:', userData);
        
        throw new Error(
          'Contract verification failed. Please ensure your wallet is properly registered.\n' +
          'Try using /start to re-register your wallet.'
        );
      }

      await handleTokenReward(bot, chatId, userAddress, finalScore);

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
}

// Update the handleTokenReward function to have bot pay gas
const handleTokenReward = async (bot, chatId, userAddress, finalScore) => {
  try {
    verifyEnvironment();

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('Setting up contract interaction...');
    console.log('User address:', userAddress);
    console.log('Bot wallet:', botWallet.address);

    const quizManager = new ethers.Contract(
      process.env.SIMBIQUIZMANAGER_CA,
      QUIZ_MANAGER_ABI,
      botWallet  // Using bot's wallet as signer
    );

    // Remove balance check since bot pays gas
    console.log('Sending completeQuiz transaction from bot wallet...');
    const tx = await quizManager.completeQuiz(
      userAddress,  // reward recipient 
      finalScore * 10,  // reward amount
      {
        from: botWallet.address,  // explicitly set sender
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
      }
    );

    console.log('Transaction sent:', tx.hash);
    await bot.sendMessage(
      chatId,
      `🎉 Quiz Complete!\nProcessing ${finalScore * 10} SIMBI tokens...\n` +
      `Transaction: https://sepolia.basescan.org/tx/${tx.hash}`
    );

    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      await bot.sendMessage(
        chatId,
        `✅ Congratulations!\n` +
        `You earned: ${finalScore * 10} SIMBI tokens\n` +
        `View transaction: https://sepolia.basescan.org/tx/${receipt.hash}`
      );
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error('Reward error:', error);
    throw error;
  }
};

// Update the handleReregister function
const handleReregister = async (bot, chatId) => {
  try {
    const users = await loadUsers();
    const userWallet = users[chatId]?.address;
    
    if (!userWallet) {
      bot.sendMessage(chatId, '❌ No wallet found. Please use /start first.');
      return;
    }

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    
    // Add debug logs
    console.log('Debug Registration:');
    console.log('RPC URL:', process.env.BASE_SEPOLIA_RPC_URL);
    console.log('Contract Address:', process.env.SIMBIQUIZMANAGER_CA);
    console.log('User Wallet:', userWallet);
    console.log('Bot Wallet:', new ethers.Wallet(process.env.PRIVATE_KEY).address);

    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const quizManager = new ethers.Contract(
      process.env.SIMBIQUIZMANAGER_CA,
      QUIZ_MANAGER_ABI,
      signer
    );

    // Add gas settings and value explicitly
    const tx = await quizManager.registerWallet(userWallet, {
      gasLimit: 500000,
      maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
    });

    console.log('Registration tx sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Registration confirmed:', receipt);

    if (receipt.status === 1) {
      await bot.sendMessage(chatId, '✅ Wallet registered successfully! Try /quiz again.');
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error('Registration error details:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      transaction: error.transaction
    });

    await bot.sendMessage(
      chatId, 
      '❌ Failed to register wallet.\n' +
      'Please ensure:\n' +
      '1. Your wallet has Base Sepolia ETH\n' +
      '2. The contract is deployed correctly\n' +
      'Try /start again or contact support.'
    );
  }
};

// At the bottom of the file
export { 
  handleQuizCommand, 
  handleQuizCallback, 
  handleAnswerCallback, 
  handleReregister 
};