// It allows users to select a quiz category, answer questions, and rewards them with tokens for correct answers.
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { getUser, saveUser, loadUsers, saveUsers } from '../db-adapter.js';

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

console.log('Loaded Quiz Data:', quizData); // Debugging log

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIQUIZMANAGER_CA:', process.env.SIMBIQUIZMANAGER_CA);

// Continue with the rest of the file, replacing the direct users.json calls
const handleQuizCommand = async (bot, users, chatId, quizManagerAddress, privateKey, rpcUrl) => {
  try {
    // Get user data from database
    const userInfo = await getUser(chatId.toString());
    
    // Check if user has a wallet address
    if (!userInfo || !userInfo.walletAddress) {
      return bot.sendMessage(
        chatId,
        "⚠️ You don't have a wallet yet. Use /start to create one and then try again.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
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
  } catch (error) {
    console.error('Error handling quiz command:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred while processing the quiz command. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

const handleQuizCallback = async (bot, users, chatId, data) => {
  try {
    // Get user from database
    const userInfo = await getUser(chatId);
    if (!userInfo) {
      return bot.sendMessage(chatId, '❌ User not found. Please use /start to set up.');
    }
    
    // Check if it's a quiz category selection
    if (data.startsWith('quiz_')) {
      const category = data.split('_')[1];
      
      if (!quizData[category]) {
        return bot.sendMessage(chatId, '❌ Invalid category selected. Please try again.');
      }
      
      // Update user data for new quiz
      const updatedUserInfo = {
        ...userInfo,
        category,
        currentQuestionIndex: 0,
        quizStartTime: Date.now(),
        quizScore: 0
      };
      
      // Save to database
      await saveUser(chatId, updatedUserInfo);
      
      // Start the quiz by showing the first question
      await progressToNextQuestion(bot, users, chatId, category, quizData[category]);
    }
  } catch (error) {
    console.error('Error handling quiz callback:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

const handleAnswerCallback = async (bot, users, chatId, data) => {
  try {
    // Get user from database
    const userInfo = await getUser(chatId);
    
    if (!userInfo) {
      return bot.sendMessage(chatId, '❌ User not found. Please use /start to set up.');
    }
    
    if (!data.startsWith('answer_')) {
      return;
    }

    const selectedAnswer = parseInt(data.split('_')[1], 10);
    const { category, currentQuestionIndex } = userInfo;
    
    if (!category || currentQuestionIndex === undefined || !quizData[category]) {
      return bot.sendMessage(
        chatId,
        '❌ Quiz session not found. Please start a new quiz with /quiz.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    const quizzes = quizData[category];
    const currentQuiz = quizzes[currentQuestionIndex];
    
    if (!currentQuiz) {
      return bot.sendMessage(
        chatId,
        '❌ Question not found. Please start a new quiz with /quiz.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    // Get the correct answer
    const correctAnswerText = currentQuiz.answer;
    const options = currentQuiz.options || [];
    const correctAnswerIndex = options.findIndex(option => option === correctAnswerText);
    
    const isCorrect = selectedAnswer === correctAnswerIndex;
    
    // Update score
    const currentScore = userInfo.quizScore || 0;
    const newScore = isCorrect ? currentScore + 1 : currentScore;
    
    // Update user data
    const updatedUserInfo = {
      ...userInfo,
      quizScore: newScore,
      currentQuestionIndex: currentQuestionIndex + 1
    };
    
    // Save to database
    await saveUser(chatId, updatedUserInfo);
    
    // Show result of the current question
    const resultMessage = isCorrect
      ? '✅ Correct answer!'
      : `❌ Incorrect. The correct answer was: ${correctAnswerText}`;
    
    await bot.sendMessage(chatId, resultMessage);
    
    // Check if quiz is complete
    if (currentQuestionIndex + 1 >= quizzes.length) {
      await completeQuiz(bot, chatId, newScore, quizzes.length);
    } else {
      // Proceed to next question
      await progressToNextQuestion(bot, users, chatId, category, quizzes);
    }
  } catch (error) {
    console.error('Error handling answer callback:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

// Helper to show the next question
const progressToNextQuestion = async (bot, users, chatId, category, quizzes) => {
  try {
    // Get updated user data
    const userInfo = await getUser(chatId);
    
    if (!userInfo || category !== userInfo.category) {
      return bot.sendMessage(
        chatId,
        '❌ Quiz session lost. Please start a new quiz with /quiz.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    const currentQuestionIndex = userInfo.currentQuestionIndex || 0;
    
    if (currentQuestionIndex >= quizzes.length) {
      return completeQuiz(bot, chatId, userInfo.quizScore || 0, quizzes.length);
    }
    
    const currentQuiz = quizzes[currentQuestionIndex];
    
    if (!currentQuiz) {
      return bot.sendMessage(
        chatId,
        '❌ Question not found. Please start a new quiz with /quiz.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    const questionNumber = currentQuestionIndex + 1;
    const totalQuestions = quizzes.length;
    
    const questionMessage = `
📝 *Quiz: ${category.charAt(0).toUpperCase() + category.slice(1)}*
*Question ${questionNumber}/${totalQuestions}:*

${currentQuiz.question}
`;
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: (currentQuiz.options || []).map((answer, index) => [
          { text: answer, callback_data: `answer_${index}` }
        ])
      }
    };
    
    await bot.sendMessage(chatId, questionMessage, options);
  } catch (error) {
    console.error('Error progressing to next question:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

// Function to complete the quiz and handle rewards
const completeQuiz = async (bot, chatId, score, totalQuestions) => {
  try {
    // Get user from database
    const userInfo = await getUser(chatId);
    
    if (!userInfo || !userInfo.walletAddress) {
      return bot.sendMessage(
        chatId,
        "⚠️ You need a wallet to record quiz results. Use /start to create one.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    // Calculate percentage score
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // Format the score for display
    const formattedScore = score;
    
    // Increment completedQuizzes counter
    const currentCompleted = userInfo.completedQuizzes || 0;
    const updatedUserInfo = {
      ...userInfo,
      completedQuizzes: currentCompleted + 1
    };
    
    // Save updated user data to database
    await saveUser(chatId, updatedUserInfo);
    console.log(`Quiz completed. User now has ${updatedUserInfo.completedQuizzes} completed quizzes.`);
    
    // Show loading message while we process the blockchain reward
    const loadingMessage = await bot.sendMessage(chatId, "🔄 Processing your quiz results and token reward...");
    
    try {
      // Reward tokens via smart contract
      await processQuizReward(bot, chatId, userInfo.walletAddress, formattedScore);
      
      // Delete loading message
      await bot.deleteMessage(chatId, loadingMessage.message_id);
    } catch (rewardError) {
      console.error('Error processing quiz reward:', rewardError);
    }
  } catch (error) {
    console.error('Error completing quiz:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred while completing the quiz. Your progress has been saved.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

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
                // Get the current user data
                const userInfo = await getUser(chatId);
                
                // Create an updated user object
                const updatedUserInfo = { ...userInfo };
                
                // Add or increment the completedQuizzes counter
                if (!updatedUserInfo.completedQuizzes) {
                    updatedUserInfo.completedQuizzes = 1;
                } else {
                    updatedUserInfo.completedQuizzes += 1;
                }
                
                // Add or update quizScore
                if (!updatedUserInfo.quizScore) {
                    updatedUserInfo.quizScore = finalScore;
                } else {
                    updatedUserInfo.quizScore += finalScore;
                }
                
                // Save the updated user data to the database
                await saveUser(chatId, updatedUserInfo);
                console.log(`Quiz stats saved to database. User now has ${updatedUserInfo.completedQuizzes} completed quizzes with score ${updatedUserInfo.quizScore}`);
                
                // Now try to update on-chain stats
                updateQuizStats(botWallet, process.env.SIMBIQUIZMANAGER_CA, userAddress, finalScore);
            } catch (e) {
                console.log('Background quiz stats update failed (non-critical):', e.message);
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
        
        // Try multiple possible methods to ensure at least one works
        try {
            // 1. First try recordQuizCompletion
            try {
                const tx = await quizManagerWithSigner.recordQuizCompletion(
                    userAddress, 
                    score,
                    { gasLimit: 300000n }
                );
                console.log('Quiz stats update (recordQuizCompletion) sent:', tx.hash);
                await tx.wait();
                console.log('recordQuizCompletion successful');
                return;
            } catch (err) {
                console.log('recordQuizCompletion failed, trying alternative:', err.message);
            }
            
            // 2. Try updateQuizStats
            try {
                const tx = await quizManagerWithSigner.updateQuizStats(
                    userAddress, 
                    score,
                    { gasLimit: 300000n }
                );
                console.log('Quiz stats update (updateQuizStats) sent:', tx.hash);
                await tx.wait();
                console.log('updateQuizStats successful');
                return;
            } catch (err2) {
                console.log('updateQuizStats failed, trying alternative:', err2.message);
            }
            
            // 3. Try completeQuiz
            try {
                const tx = await quizManagerWithSigner.completeQuiz(
                    userAddress, 
                    score,
                    { gasLimit: 300000n }
                );
                console.log('Quiz stats update (completeQuiz) sent:', tx.hash);
                await tx.wait();
                console.log('completeQuiz successful');
                return;
            } catch (err3) {
                console.log('completeQuiz failed:', err3.message);
                console.log('All quiz stats update methods failed');
            }
        } catch (err) {
            console.log('Quiz stats update general error:', err.message);
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
    const userWallet = users[chatId]?.walletAddress;
    
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

// Add this function for handling quiz rewards
async function processQuizReward(bot, chatId, userAddress, finalScore) {
  try {
    console.log(`Processing quiz reward for ${userAddress}, score: ${finalScore}`);
    
    // Verify environment
    verifyEnvironment();
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Basic validation
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }
    
    // Proceed with reward
    await handleTokenReward(bot, chatId, userAddress, finalScore);
    
    return true;
  } catch (error) {
    console.error('Quiz reward processing error:', error);
    await bot.sendMessage(
      chatId,
      '⚠️ Could not process rewards, but your progress has been saved.'
    );
    throw error; // Re-throw for upstream handling
  }
}

// At the bottom of the file
export { 
  handleQuizCommand, 
  handleQuizCallback, 
  handleAnswerCallback, 
  handleReregister 
};