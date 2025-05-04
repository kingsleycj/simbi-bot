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
  "function isRegistered(address) external view returns (bool)",
  "function owner() external view returns (address)",
  "function token() external view returns (address)",
  "function registerWallet(address wallet) external",
  "function reRegisterWallet(address wallet) external",
  "function credentialIssued(address) external view returns (bool)",
  "function completedQuizzes(address) external view returns (uint256)"
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

// Update the verifyContractState function
async function verifyContractState(provider, contractAddress, userAddress) {
  try {
    console.log('\n=== Contract Verification Debug ===');
    console.log('Contract address:', contractAddress);
    console.log('User address:', userAddress);

    // Verify contract code exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      console.error('Contract not found at specified address');
      return false;
    }

    const quizManager = new ethers.Contract(
      contractAddress,
      QUIZ_MANAGER_ABI,
      provider
    );

    // Check registration status first
    const isRegistered = await quizManager.isRegistered(userAddress);
    console.log('Is wallet registered?', isRegistered);
    
    if (!isRegistered) {
      console.error('Wallet not registered in contract');
      return false;
    }

    // Additional contract checks
    const owner = await quizManager.owner();
    const token = await quizManager.token();
    console.log('Contract owner:', owner);
    console.log('Token contract:', token);

    return true;

  } catch (error) {
    console.error('Contract verification failed:', {
      error: error.message,
      code: error.code,
      reason: error.reason
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

// Update the handleQuizCallback function to remove registration check
const handleQuizCallback = async (bot, users, chatId, data) => {
  try {
    console.log('\n=== Quiz Start Debug ===');
    const currentUsers = await loadUsers();
    console.log('Current users data:', currentUsers);
    console.log('Chat ID:', chatId);
    
    // Log registration status
    if (currentUsers[chatId]) {
      console.log('User wallet:', currentUsers[chatId].address);
      console.log('Is registered:', currentUsers[chatId].isRegistered);
    }

    // 1. Check if user has wallet and is registered
    if (!currentUsers[chatId] || !currentUsers[chatId].address || !currentUsers[chatId].isRegistered) {
      await bot.sendMessage(
        chatId, 
        '❌ Please use /start first to create and register your wallet.'
      );
      return;
    }

    // 2. Initialize quiz state
    const category = data.split('_')[1];
    const quizzes = quizData[category];
    
    if (!quizzes || !Array.isArray(quizzes)) {
      throw new Error(`Invalid quiz category: ${category}`);
    }

    users[chatId] = {
      ...currentUsers[chatId],
      score: 0,
      currentQuestionIndex: 0,
      category: category,
      quizStartTime: Date.now()
    };

    // 3. Display first question
    const firstQuiz = quizzes[0];
    const options = {
      reply_markup: {
        inline_keyboard: firstQuiz.options.map((option, index) => [
          { text: option, callback_data: `answer_${category}_${index}` }
        ])
      }
    };

    await bot.sendMessage(
      chatId,
      `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*\n\n` +
      `Question 1/${quizzes.length}\n\n${firstQuiz.question}`,
      { parse_mode: 'Markdown', ...options }
    );

    // 4. Save quiz state
    await saveUsers(users);

  } catch (error) {
    console.error('Quiz error:', error);
    await bot.sendMessage(
      chatId, 
      '❌ An error occurred starting the quiz.\n' +
      'Please try again or contact support.'
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
    
    try {
      verifyEnvironment();
      
      const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
      const userAddress = users[chatId]?.address;
      
      if (!userAddress) {
        throw new Error('No wallet address found. Use /start to create one.');
      }

      // Check registration status first
      console.log('Checking wallet registration...');
      const quizManager = new ethers.Contract(
        process.env.SIMBIQUIZMANAGER_CA,
        QUIZ_MANAGER_ABI,
        provider
      );

      const isRegistered = await quizManager.isRegistered(userAddress);
      console.log('Is registered:', isRegistered);

      if (!isRegistered) {
        await bot.sendMessage(
          chatId,
          '⚠️ Your wallet needs to be registered first.\n' +
          'Please use /start to register your wallet.'
        );
        return;
      }

      // Proceed with reward if registered
      await handleTokenReward(bot, chatId, userAddress, finalScore);

    } catch (error) {
      console.error('Quiz completion error:', {
        message: error.message,
        code: error.code,
        reason: error.reason
      });
      
      await bot.sendMessage(
        chatId,
        `⚠️ Error processing quiz completion:\n${error.message}\n\n` +
        'Please try using /start to re-register your wallet.'
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

// Update the handleTokenReward function
const handleTokenReward = async (bot, chatId, userAddress, finalScore) => {
  try {
    console.log('\n=== Debug Token Reward ===');
    console.log('Contract Address:', process.env.SIMBIQUIZMANAGER_CA);
    console.log('User Address:', userAddress);
    console.log('Score:', finalScore);
    console.log('Bot Wallet:', process.env.PRIVATE_KEY ? `0x${ethers.computeAddress(`0x${process.env.PRIVATE_KEY}`)}` : 'Not available');

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Get contract interface for proper function encoding
    const quizManager = new ethers.Contract(
      process.env.SIMBIQUIZMANAGER_CA,
      QUIZ_MANAGER_ABI,
      botWallet
    );

    // Check contract state
    const owner = await quizManager.owner();
    console.log('Contract owner:', owner);
    console.log('Bot is owner:', owner.toLowerCase() === botWallet.address.toLowerCase());

    // Get token contract address
    const tokenAddress = await quizManager.token();
    console.log('Token contract:', tokenAddress);

    // Check if user is registered
    const isRegistered = await quizManager.isRegistered(userAddress);
    console.log('User is registered:', isRegistered);

    // Encode function data to debug call
    const rewardAmount = BigInt(finalScore * 10);
    const data = quizManager.interface.encodeFunctionData("completeQuiz", [userAddress, rewardAmount]);
    console.log('Encoded transaction data:', data);

    // Estimate gas before sending
    const gasEstimate = await quizManager.completeQuiz.estimateGas(
      userAddress,
      rewardAmount
    );
    console.log('Estimated gas:', gasEstimate.toString());

    // Send transaction with explicit parameters
    console.log('Sending reward transaction...');
    const tx = await quizManager.completeQuiz(
      userAddress,
      rewardAmount,
      {
        gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
        maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei'),
        nonce: await provider.getTransactionCount(botWallet.address)
      }
    );

    console.log('Transaction hash:', tx.hash);
    
    await bot.sendMessage(
      chatId,
      `🎮 Processing your quiz reward...\nTransaction: https://sepolia.basescan.org/tx/${tx.hash}`
    );

    const receipt = await tx.wait();
    console.log('Transaction receipt:', JSON.stringify(receipt, null, 2));

    if (receipt.status === 1) {
      await bot.sendMessage(
        chatId,
        `✅ Quiz reward processed!\nYou earned ${rewardAmount.toString()} SIMBI tokens\nView transaction: https://sepolia.basescan.org/tx/${receipt.hash}`
      );
    } else {
      throw new Error('Transaction failed');
    }

  } catch (error) {
    console.error('Reward Error:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      tx: error.transaction,
      data: error.data,
      receipt: error.receipt
    });

    // Try to decode error if possible
    if (error.data) {
      try {
        const decodedError = quizManager.interface.parseError(error.data);
        console.error('Decoded error:', decodedError);
      } catch (e) {
        console.error('Could not decode error data');
      }
    }

    await bot.sendMessage(
      chatId,
      '❌ Failed to process reward. Please contact support with this error code: ' +
      `${error.code || 'UNKNOWN'}`
    );
    
    throw error;
  }
};

// Update the handleReregister function
const handleReregister = async (bot, chatId) => {
  try {
    const users = await loadUsers();
    const userWallet = users[chatId]?.address;
    
    if (!userWallet) {
      await bot.sendMessage(chatId, '❌ No wallet found. Please use /start first.');
      return;
    }

    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('\n=== Wallet Registration Debug ===');
    console.log('User Wallet:', userWallet);
    console.log('Bot Wallet:', botWallet.address);
    console.log('Contract:', process.env.SIMBIQUIZMANAGER_CA);

    const quizManager = new ethers.Contract(
      process.env.SIMBIQUIZMANAGER_CA,
      QUIZ_MANAGER_ABI,
      botWallet // Using bot wallet as signer
    );

    // Encode function data for better error handling
    const data = quizManager.interface.encodeFunctionData("registerWallet", [userWallet]);
    console.log('Encoded transaction data:', data);

    // Send transaction with explicit parameters
    const tx = await quizManager.registerWallet(userWallet, {
      from: botWallet.address,
      gasLimit: 500000,
      value: 0, // No ETH being sent
      nonce: await provider.getTransactionCount(botWallet.address),
      type: 2, // EIP-1559 transaction
      maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
    });

    console.log('Registration transaction sent:', tx.hash);
    
    await bot.sendMessage(
      chatId, 
      '🔄 Registering wallet...\n' +
      `Transaction: https://sepolia.basescan.org/tx/${tx.hash}`
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
        '✅ Wallet registered successfully!\n' +
        'You can now continue with the quiz.'
      );
      return true;
    }

    throw new Error('Transaction failed');

  } catch (error) {
    console.error('Registration error:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      transaction: error.transaction
    });

    await bot.sendMessage(
      chatId, 
      '❌ Wallet registration failed.\n' +
      'The bot will handle all gas fees, just try /quiz again.'
    );
    return false;
  }
};

// At the bottom of the file
export { 
  handleQuizCommand, 
  handleQuizCallback, 
  handleAnswerCallback, 
  handleReregister 
};