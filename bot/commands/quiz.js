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

// Update the ABIs at the top of the file
const QUIZ_MANAGER_ABI = [
    "function completeQuiz(address user, uint256 score) external",
    "function isRegistered(address) external view returns (bool)",
    "function token() external view returns (address)",
    "function owner() external view returns (address)",
    "function registerWallet(address wallet) external",
    "function reRegisterWallet(address wallet) external",
    "function rewardPerQuiz() external view returns (uint256)"
];

const TOKEN_ABI = [
    "function mintToUser(address to, uint256 amount) external",
    "function balanceOf(address) external view returns (uint256)",
    "function minters(address) external view returns (bool)",
    "function owner() external view returns (address)",
    "function getUserMinted() external view returns (uint256)",
    "function USER_SUPPLY_CAP() external view returns (uint256)",
    "function getRemainingUserSupply() external view returns (uint256)"
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

const handleQuizCommand = async (bot, users, chatId) => {
  // Always load fresh user data
  const freshUsers = await loadUsers();
  
  // Update in-memory users with fresh data
  if (freshUsers[chatId] && !users[chatId]) {
    users[chatId] = freshUsers[chatId];
  }

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

// Update the handleQuizCallback function to ensure users data is loaded
const handleQuizCallback = async (bot, users, chatId, data) => {
  try {
    console.log('\n=== Quiz Start Debug ===');
    // Always load fresh user data
    const currentUsers = await loadUsers();
    console.log('Current users data:', currentUsers);
    console.log('Chat ID:', chatId);
    
    // Update in-memory users with fresh data
    if (currentUsers[chatId] && !users[chatId]) {
      users[chatId] = currentUsers[chatId];
    }
    
    // Log registration status
    if (users[chatId]) {
      console.log('User wallet:', users[chatId].address);
      console.log('Is registered:', users[chatId].isRegistered);
    }

    // 1. Check if user has wallet and is registered
    if (!users[chatId] || !users[chatId].address || !users[chatId].isRegistered) {
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

const handleAnswerCallback = async (bot, users, chatId, data) => {
  // Always load fresh user data
  const freshUsers = await loadUsers();
  
  // Update in-memory users with fresh data
  if (freshUsers[chatId] && !users[chatId]) {
    users[chatId] = freshUsers[chatId];
  }

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

    // Instead of deleting user data, just remove the quiz progress
    // We keep the user's wallet and other information
    if (users[chatId]) {
      // Increment completedQuizzes counter
      if (!users[chatId].completedQuizzes) {
        users[chatId].completedQuizzes = 1;
      } else {
        users[chatId].completedQuizzes += 1;
      }
      
      // Remove only quiz-specific properties
      delete users[chatId].score;
      delete users[chatId].currentQuestionIndex;
      delete users[chatId].category;
      delete users[chatId].quizStartTime;
    }
    
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
        console.log('\n=== Processing Quiz Reward ===');
        console.log('User:', userAddress);
        console.log('Score:', finalScore);

        // Verify environment variables first
        verifyEnvironment();

        // Validate user address
        if (!ethers.isAddress(userAddress)) {
            throw new Error('Invalid user address format');
        }

        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        
        // Create separate instances for different checks
        const readProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log('Bot Wallet Address:', botWallet.address);
        console.log('Contract Address:', process.env.SIMBIQUIZMANAGER_CA);

        // Check bot wallet balance
        const botBalance = await provider.getBalance(botWallet.address);
        console.log('Bot Wallet Balance:', ethers.formatEther(botBalance), 'ETH');
        
        const minRequiredBalance = ethers.parseEther('0.01'); // 0.01 ETH minimum
        if (botBalance < minRequiredBalance) {
            throw new Error('Bot wallet has insufficient funds for gas fees');
        }
        
        // Use a non-signer provider for basic calls to prevent any issues
        const quizManager = new ethers.Contract(
            process.env.SIMBIQUIZMANAGER_CA,
            QUIZ_MANAGER_ABI,
            readProvider
        );

        // Verify contract ownership
        const owner = await quizManager.owner();
        console.log('Contract owner:', owner);
        console.log('Is bot owner?', owner.toLowerCase() === botWallet.address.toLowerCase());

        if (owner.toLowerCase() !== botWallet.address.toLowerCase()) {
            throw new Error('Bot wallet is not the contract owner');
        }

        // Verify contract state
        console.log('Verifying contract state...');
        const isRegistered = await quizManager.isRegistered(userAddress);
        console.log('Is user registered:', isRegistered);

        if (!isRegistered) {
            throw new Error('User not registered. Please use /start to register.');
        }

        // Get reward amount
        const rewardPerQuiz = await quizManager.rewardPerQuiz();
        console.log('Reward per quiz:', ethers.formatEther(rewardPerQuiz));

        // Get token contract address
        const tokenAddress = await quizManager.token();
        console.log('Token contract address:', tokenAddress);

        // Initialize token contract
        const tokenContract = new ethers.Contract(
            tokenAddress,
            TOKEN_ABI,
            botWallet  // Use bot wallet signer for token contract
        );

        console.log('Token contract initialized with signer');
        
        // Verify bot is owner of token contract
        const tokenOwner = await tokenContract.owner();
        console.log('Token contract owner:', tokenOwner);
        console.log('Is bot token owner?', tokenOwner.toLowerCase() === botWallet.address.toLowerCase());
        
        if (tokenOwner.toLowerCase() !== botWallet.address.toLowerCase()) {
            throw new Error('Bot wallet is not the token contract owner');
        }

        // Get initial balance
        const initialBalance = await tokenContract.balanceOf(userAddress);
        console.log('Initial token balance:', ethers.formatEther(initialBalance));

        // Check remaining supply without calling getUserMinted
        try {
            const remainingSupply = await tokenContract.getRemainingUserSupply();
            console.log('Remaining token supply:', ethers.formatEther(remainingSupply));
            
            if (remainingSupply < rewardPerQuiz) {
                throw new Error('Insufficient token supply for rewards');
            }
        } catch (error) {
            console.log('Could not check remaining supply, proceeding anyway:', error.message);
        }

        console.log('Directly minting tokens to user...');
        // MINT DIRECTLY: Call mintToUser function of token contract directly
        const tx = await tokenContract.mintToUser(
            userAddress,
            rewardPerQuiz,
            {
                gasLimit: 500000n,
                maxFeePerGas: ethers.parseUnits('2', 'gwei'),
                maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
            }
        );

        console.log('Transaction sent:', tx.hash);
        console.log('Transaction details:', {
            to: tx.to,
            from: tx.from,
            data: tx.data,
            gasLimit: tx.gasLimit?.toString(),
            maxFeePerGas: tx.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString()
        });
        
        await bot.sendMessage(
            chatId,
            `🎮 Processing reward...\nTransaction: https://sepolia.basescan.org/tx/${tx.hash}`
        );

        // Wait for transaction confirmation
        console.log('Waiting for transaction confirmation...');
        const receipt = await tx.wait(1);
        console.log('Transaction receipt:', {
            status: receipt.status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
            logs: receipt.logs.length
        });
        
        if (receipt.status === 1) {
            // Verify token transfer
            const newBalance = await tokenContract.balanceOf(userAddress);
            console.log('New balance:', ethers.formatEther(newBalance));
            
            await bot.sendMessage(
                chatId,
                `✅ Quiz completed successfully!\n\n` +
                `Score: ${finalScore}\n` +
                `Reward: ${ethers.formatEther(rewardPerQuiz)} SIMBI\n` +
                `New Balance: ${ethers.formatEther(newBalance)} SIMBI\n` +
                `Transaction: https://sepolia.basescan.org/tx/${receipt.hash}`
            );
            
            // Update quiz stats in the background (non-blocking)
            try {
                // Record quiz stats asynchronously (don't await)
                updateQuizStats(botWallet, process.env.SIMBIQUIZMANAGER_CA, userAddress, finalScore);
            } catch (e) {
                console.log('Background quiz stats update failed (non-critical):', e.message);
            }
            
            // Make sure to load the latest user data before redirecting
            try {
                const usersFile = path.join(process.cwd(), 'users.json');
                const userData = await fs.readFile(usersFile, 'utf8');
                const updatedUsers = JSON.parse(userData);
                
                // Keep the user data in memory
                if (updatedUsers[chatId] && !users[chatId]) {
                    users[chatId] = updatedUsers[chatId];
                }
                
                // Ensure completedQuizzes is updated and saved to file
                if (users[chatId]) {
                    if (!users[chatId].completedQuizzes) {
                        users[chatId].completedQuizzes = 1;
                    } else {
                        users[chatId].completedQuizzes += 1;
                    }
                    
                    // Save changes back to file
                    await fs.writeFile(usersFile, JSON.stringify(updatedUsers, null, 2));
                    console.log(`Quiz completion saved. User now has ${users[chatId].completedQuizzes} completed quizzes`);
                }
            } catch (e) {
                console.error('Error updating completed quizzes:', e);
            }
            
            // Redirect to menu to reset state and ensure data consistency
            setTimeout(() => {
                try {
                    // Use explicit string conversion of chatId to ensure consistency
                    const chatIdStr = chatId.toString();
                    console.log(`Redirecting to menu after quiz completion. ChatID: ${chatIdStr}`);
                    bot.sendMessage(
                        chatId,
                        "⏱️ Returning to menu to ensure data is up to date...",
                        {
                            reply_markup: {
                                inline_keyboard: [[{ text: "🔄 Open Menu", callback_data: "menu" }]]
                            }
                        }
                    );
                } catch (menuError) {
                    console.error('Failed to redirect to menu:', menuError);
                }
            }, 2000); // Wait 2 seconds before redirecting
            
        } else {
            throw new Error(`Transaction failed: ${tx.hash}`);
        }

    } catch (error) {
        console.error('Reward Error:', {
            message: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data,
            transaction: error.transaction ? {
                hash: error.transaction.hash,
                from: error.transaction.from,
                to: error.transaction.to,
                data: error.transaction.data?.substring(0, 200) // Truncate data for readability
            } : null,
            receipt: error.receipt ? {
                status: error.receipt.status,
                logs: error.receipt.logs?.length
            } : null
        });

        let errorMessage = '❌ Failed to process reward.\n';
        
        if (error.code === 'INSUFFICIENT_FUNDS') {
            errorMessage += 'Bot wallet has insufficient funds for gas fees.';
        } else if (error.code === 'NETWORK_ERROR') {
            errorMessage += 'Network error. Please try again later.';
        } else if (error.message.includes('timeout')) {
            errorMessage += 'Transaction timed out. Please try again.';
        } else if (error.message.includes('Contract not found')) {
            errorMessage += 'Contract not found. Please contact support.';
        } else if (error.message.includes('Wallet not registered')) {
            errorMessage += 'Wallet not registered. Please use /start to register.';
        } else if (error.message.includes('Invalid user address')) {
            errorMessage += 'Invalid wallet address. Please use /start to create a new wallet.';
        } else if (error.message.includes('Token contract not found')) {
            errorMessage += 'Token contract not found. Please contact support.';
        } else if (error.message.includes('execution reverted')) {
            errorMessage += 'Transaction reverted. Please try /start to re-register your wallet.';
        } else if (error.message.includes('not the contract owner')) {
            errorMessage += 'Bot configuration error. Please contact support.';
        } else if (error.message.includes('not authorized to mint tokens')) {
            errorMessage += 'QuizManager contract is not authorized to mint tokens. Please contact support.';
        } else if (error.message.includes('Insufficient token supply')) {
            errorMessage += 'Token supply cap reached. Please contact support.';
        } else {
            errorMessage += error.message;
        }

        await bot.sendMessage(chatId, errorMessage);
        
        // Only throw if it's a critical error that needs attention
        if (error.code === 'INSUFFICIENT_FUNDS' || 
            error.message.includes('Contract not found') || 
            error.message.includes('Token contract not found') ||
            error.message.includes('not the contract owner') ||
            error.message.includes('not authorized to mint tokens')) {
            throw error;
        }
    }
};

// Helper function to update quiz stats in QuizManager
async function updateQuizStats(signer, quizManagerAddress, userAddress, score) {
    try {
        // Get QuizManager contract with signer
        const quizManagerWithSigner = new ethers.Contract(
            quizManagerAddress,
            QUIZ_MANAGER_ABI,
            signer
        );
        
        // Just record the quiz attempt for badge eligibility
        try {
            // Update the completedQuizzes counter (minimal function call)
            const tx = await quizManagerWithSigner.recordQuizCompletion(
                userAddress, 
                score,
                { gasLimit: 200000n }
            );
            console.log('Quiz stats update sent:', tx.hash);
        } catch (err) {
            console.log('recordQuizCompletion not available, trying alternative methods');
            
            // Try updateQuizStats function
            try {
                const tx = await quizManagerWithSigner.updateQuizStats(
                    userAddress, 
                    score,
                    { gasLimit: 200000n }
                );
                console.log('Quiz stats update sent:', tx.hash);
            } catch (err2) {
                console.log('No suitable method found to update quiz stats');
            }
        }
    } catch (error) {
        console.error('Failed to update quiz stats:', error.message);
        // Not critical, so we don't rethrow
    }
}

// Update the handleReregister function
const handleReregister = async (bot, chatId) => {
  try {
    // Always load fresh user data
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
    const tx = await quizManager.registerWallet(
      userWallet,
      {
        gasLimit: 500000n,
        maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
      }
    );

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
      // Update user's registration status
      users[chatId].isRegistered = true;
      await saveUsers(users);
      
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