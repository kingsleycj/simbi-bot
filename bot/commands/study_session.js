// This file handles the study session command and callbacks
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

// Contract ABIs
const QUIZ_MANAGER_ABI = [
    "function completeQuiz(address user, uint256 score) external",
    "function isRegistered(address) external view returns (bool)",
    "function token() external view returns (address)",
    "function owner() external view returns (address)",
    "function registerWallet(address wallet) external",
    "function reRegisterWallet(address wallet) external",
    "function rewardPerQuiz() external view returns (uint256)"
];

const BADGE_NFT_ABI = [
    "function recordQuizAttempt(address user, uint256 score) external",
    "function getEligibleTier(address user) external view returns (uint8)",
    "function safeMint(address to, uint8 tier) external",
    "function getAttemptCounts(address user) external view returns (uint256 bronze, uint256 silver, uint256 gold)",
    "function getTierBaseURI(uint8 tier) external view returns (string memory)"
];

// Load users data
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
        
        // Handle empty file case
        if (!data.trim()) {
            await fs.writeFile(USERS_FILE_PATH, '{}');
            return {};
        }

        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            await fs.writeFile(USERS_FILE_PATH, '{}');
            return {};
        }
        console.error('Error loading users:', error);
        return {};
    }
}

// Save users data
async function saveUsers(users) {
    try {
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users data:', error);
    }
}

// Verify environment variables
const verifyEnvironment = () => {
    const required = [
        'BASE_SEPOLIA_RPC_URL',
        'SIMBIQUIZMANAGER_CA',
        'PRIVATE_KEY',
        'SIMBIBADGE_NFT_CA'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
};

// Verify contract state
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

// Handle /study_session command
const handleStudySessionCommand = async (bot, users, chatId) => {
    try {
        // Debug info
        console.log('\n=== Study Session Command Debug ===');
        console.log('Chat ID:', chatId);
        console.log('Users object available:', !!users);
        
        // Always load fresh user data
        const freshUsers = await loadUsers();
        console.log('Fresh users keys:', Object.keys(freshUsers));
        
        // Ensure consistent string format for chatId
        const chatIdStr = chatId.toString();
        
        // CRITICAL FIX: Always update in-memory users with fresh data
        if (freshUsers[chatIdStr]) {
            users[chatIdStr] = freshUsers[chatIdStr];
        }
        
        console.log('Updated users keys:', Object.keys(users));
        
        // Get user info using consistent chatId
        const userInfo = users[chatIdStr];
        console.log('User exists:', !!userInfo);
        
        // Check if user has a wallet
        if (!userInfo || !userInfo.address) {
            console.log('No wallet found for user');
            return bot.sendMessage(
                chatId,
                "⚠️ You need to create a wallet first. Use the /start command to set up your wallet.",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                    }
                }
            );
        }
        
        console.log('User wallet address:', userInfo.address);

        // IMPROVED RESET LOGIC: Check for and reset stale study sessions
        if (userInfo.studySessions && userInfo.studySessions.inProgress) {
            console.log('Detected in-progress study session, checking if stale...');
            const currentTime = Date.now();
            const sessionStartTime = userInfo.studySessions.startTime || 0;
            const sessionDuration = userInfo.studySessions.duration || 2;
            const expectedEndTime = sessionStartTime + (sessionDuration * 60 * 1000);
            
            // Check if the session should have ended by now (add a 2 minute buffer)
            if (currentTime > expectedEndTime + (2 * 60 * 1000)) {
                console.log('Study session is stale, resetting inProgress flag');
                userInfo.studySessions.inProgress = false;
                
                // CRITICAL FIX: Save this change immediately
                await saveUsers(users);
                
                // Log for debugging
                console.log('Study session reset. Session details:', {
                    startTime: new Date(sessionStartTime).toISOString(),
                    currentTime: new Date(currentTime).toISOString(),
                    expectedEndTime: new Date(expectedEndTime).toISOString(),
                    durationMinutes: sessionDuration
                });
            } else {
                console.log('Study session is still active:', {
                    startTime: new Date(sessionStartTime).toISOString(),
                    currentTime: new Date(currentTime).toISOString(),
                    expectedEndTime: new Date(expectedEndTime).toISOString(),
                    minutesRemaining: Math.floor((expectedEndTime - currentTime) / 60000)
                });
            }
        }

        // Initialize study sessions if needed
        if (!userInfo.studySessions) {
            userInfo.studySessions = {
                completed: 0,
                inProgress: false,
                history: []
            };
            
            // IMPORTANT: Save this initialization
            await saveUsers(users);
        }

        // Double check if session is still in progress after reset
        if (userInfo.studySessions.inProgress) {
            return bot.sendMessage(
                chatId,
                "⚠️ You already have a study session in progress! Focus on that one first.\n\nIf you believe this is an error, use the Reset Session button below.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel Study Session", callback_data: "cancel_study" }],
                            [{ text: "🔄 Reset Study Session", callback_data: "reset_study" }],
                            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
                        ]
                    }
                }
            );
        }

        // Offer duration options with the reset option
        const durationOptions = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "25 Minutes 🍅", callback_data: "study_25" },
                        { text: "50 Minutes ⏰", callback_data: "study_50" }
                    ],
                    [
                        { text: "🔄 Reset Study Session", callback_data: "reset_study" },
                        { text: "🔙 Back to Menu", callback_data: "menu" }
                    ]
                ]
            }
        };

        await bot.sendMessage(
            chatId,
            "*📚 Study Session*\n\nChoose your study session duration:\n\n" +
            "• 25 Minutes (Pomodoro style)\n" +
            "• 50 Minutes (Extended focus)\n\n" +
            "You'll earn 20 SIMBI tokens after completing the session!",
            { parse_mode: 'Markdown', ...durationOptions }
        );
    } catch (error) {
        console.error('Error handling study session command:', error);
        bot.sendMessage(
            chatId, 
            "❌ Sorry, something went wrong. Please try again later.",
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                }
            }
        );
    }
};

// Study session messages to send during the session
const encouragingMessages = [
    "💪 Keep going! You're doing great!",
    "🧠 Your brain is getting stronger with every minute!",
    "🚀 Halfway there! Keep up the amazing work!",
    "📚 Learning is a superpower, and you're becoming stronger!",
    "⏱️ Time flies when you're being productive. You're crushing it!",
    "🔥 Your future self will thank you for this dedication!",
    "✨ Focus is your superpower right now!",
    "🌟 Every minute of studying brings you closer to your goals!",
    "📝 Keep that concentration going - you're in the zone!",
    "🏆 Champions are made through consistent effort - just like you're doing now!"
];

// Handle study session callbacks
const handleStudySessionCallback = async (bot, users, chatId, data) => {
    try {
        // Debug logging
        console.log('\n=== Study Session Callback Debug ===');
        console.log('Chat ID:', chatId);
        console.log('Data:', data);
        
        // Always load fresh user data
        const freshUsers = await loadUsers();
        console.log('Fresh users keys:', Object.keys(freshUsers));
        
        // Always use string version of chatId
        const chatIdStr = chatId.toString();
        
        // Update in-memory users with fresh data - CRITICAL FIX
        if (freshUsers[chatIdStr]) {
            // Always update the in-memory user data with the latest from file
            users[chatIdStr] = freshUsers[chatIdStr];
        }
        
        console.log('User exists:', users[chatIdStr] ? 'Yes' : 'No');
        
        // Check for and forcibly reset any stale sessions - IMPROVED DETECTION
        if (users[chatIdStr] && users[chatIdStr].studySessions && users[chatIdStr].studySessions.inProgress) {
            console.log('Found potential stale session, checking timestamp...');
            const sessionStartTime = users[chatIdStr].studySessions.startTime || 0;
            const sessionDuration = users[chatIdStr].studySessions.duration || 2;
            const expectedEndTime = sessionStartTime + (sessionDuration * 60 * 1000);
            const currentTime = Date.now();
            
            // If the session should have completed over 2 minutes ago, force reset
            if (currentTime > expectedEndTime + (2 * 60 * 1000)) {
                console.log('FORCE RESETTING stale study session for user', chatIdStr);
                users[chatIdStr].studySessions.inProgress = false;
                
                // Critical fix: Save this change to both memory AND file
                await saveUsers(users);
                
                console.log('Session forcibly reset. Session details:', {
                    startTime: new Date(sessionStartTime).toISOString(),
                    duration: sessionDuration,
                    expectedEndTime: new Date(expectedEndTime).toISOString(),
                    currentTime: new Date(currentTime).toISOString(),
                    minutesSinceEnd: Math.floor((currentTime - expectedEndTime) / 60000)
                });
            }
        }
        
        if (users[chatIdStr]) {
            console.log('User address exists:', users[chatIdStr].address ? 'Yes' : 'No');
            console.log('User wallet address:', users[chatIdStr].address);
        }
        
        // Check if the user has a valid wallet
        const userInfo = users[chatIdStr];
        if (!userInfo || !userInfo.address) {
            return bot.sendMessage(
                chatId,
                "⚠️ You need to create a wallet first. Use the /start command to set up your wallet.",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                    }
                }
            );
        }

        // Parse the duration from callback data
        // For testing: 25 minutes will actually be 2 minutes
        const duration = data === "study_25" ? 2 : 50;
        
        // Initialize study sessions if not present
        if (!userInfo.studySessions) {
            userInfo.studySessions = {
                completed: 0,
                inProgress: false,
                history: []
            };
        }

        // Additional check for inProgress after potential reset
        if (userInfo.studySessions.inProgress) {
            return bot.sendMessage(
                chatId,
                "⚠️ You already have a study session in progress! Focus on that one first.",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                    }
                }
            );
        }
        
        // Update user data
        userInfo.studySessions.inProgress = true;
        userInfo.studySessions.startTime = Date.now();
        userInfo.studySessions.duration = duration;
        await saveUsers(users);
        
        // Get a sassy, motivational message for SIMBI
        const startMessages = [
            "Alright, bookworm! Let's see if you can actually focus for {{duration}} minutes. I'll be watching! ⏱️",
            "Fine, I'll believe you're studying when I see it. {{duration}} minutes starting NOW! 📚",
            "{{duration}} minutes of actual studying? This I gotta see! Clock's ticking! ⏰",
            "Brain cells, activate! You've got {{duration}} minutes to make them work. No slacking! 🧠",
            "Oh look who decided to study today! {{duration}} minutes on the clock - impress me! 📝"
        ];
        
        const startMessage = startMessages[Math.floor(Math.random() * startMessages.length)]
            .replace("{{duration}}", data === "study_25" ? "25" : "50"); // Keep UI text as 25/50
        
        await bot.sendMessage(
            chatId, 
            startMessage,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "❌ Cancel Session", callback_data: "cancel_study" }]]
                }
            }
        );
        
        // Calculate message intervals - adjusted for shorter duration
        const messageInterval = duration <= 2 ? 1 : 10; // minutes
        const sessionDurationMs = duration * 60 * 1000;
        const messageIntervalMs = messageInterval * 60 * 1000;
        
        // Send encouraging messages during the session
        const messageTimers = [];
        
        for (let i = messageInterval; i < duration; i += messageInterval) {
            const timer = setTimeout(async () => {
                const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
            }, i * 60 * 1000); // Convert minutes to milliseconds
            
            messageTimers.push(timer);
        }
        
        // Set timer for session completion
        setTimeout(async () => {
            // Clear any remaining message timers
            messageTimers.forEach(timer => clearTimeout(timer));
            
            try {
                // IMPORTANT FIX: Always reload the latest user data before updating
                const currentUsers = await loadUsers();
                const currentUserInfo = currentUsers[chatIdStr];
                
                if (currentUserInfo && currentUserInfo.studySessions && currentUserInfo.studySessions.inProgress) {
                    // Mark session as completed
                    currentUserInfo.studySessions.inProgress = false;
                    currentUserInfo.studySessions.completed += 1;
                    
                    // Add session to history for proper time tracking
                    const sessionDuration = data === "study_25" ? 25 : 50; // Use actual intended duration for stats
                    const sessionEndTime = Date.now();
                    const sessionStartTime = currentUserInfo.studySessions.startTime;
                    
                    // Initialize history array if it doesn't exist
                    if (!currentUserInfo.studySessions.history) {
                        currentUserInfo.studySessions.history = [];
                    }
                    
                    // Add this session to history
                    currentUserInfo.studySessions.history.push({
                        startTime: sessionStartTime,
                        endTime: sessionEndTime,
                        duration: sessionDuration,
                        type: data === "study_25" ? "pomodoro" : "extended"
                    });
                    
                    // Save user data to file
                    await saveUsers(currentUsers);
                    
                    // CRITICAL FIX: Update the in-memory users object as well
                    users[chatIdStr] = currentUsers[chatIdStr];
                    
                    // Send completion message
                    await bot.sendMessage(
                        chatId,
                        `🎉 Congratulations! You've completed a ${data === "study_25" ? "25" : "50"}-minute study session!\n\nProcessing your reward...`
                    );
                    
                    // IMPROVED ORDER: Record session completion first for badge tracking
                    try {
                        await checkBadgeMilestone(bot, chatId, currentUserInfo.address, currentUserInfo.studySessions.completed);
                    } catch (badgeError) {
                        console.error('Error checking badge milestone:', badgeError);
                        // Don't stop execution if badge check fails
                    }
                    
                    // Then reward tokens
                    try {
                        await rewardStudySession(bot, chatId, currentUserInfo.address);
                    } catch (rewardError) {
                        console.error('Error rewarding study session:', rewardError);
                        // Send a message if reward fails
                        await bot.sendMessage(
                            chatId,
                            "⚠️ There was an issue processing your token reward, but your progress has been saved."
                        );
                    }
                    
                    // Send options for next actions
                    await bot.sendMessage(
                        chatId,
                        "What would you like to do next?",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "📚 Start Another Session", callback_data: "study_session" },
                                        { text: "📊 View Progress", callback_data: "progress" }
                                    ],
                                    [{ text: "🔙 Back to Menu", callback_data: "menu" }]
                                ]
                            }
                        }
                    );
                }
            } catch (error) {
                console.error('Error completing study session:', error);
                await bot.sendMessage(
                    chatId,
                    "❌ There was an error completing your study session. Your progress has been saved, but rewards couldn't be processed.",
                    {
                        reply_markup: {
                            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                        }
                    }
                );
            }
        }, sessionDurationMs);
        
    } catch (error) {
        console.error('Error handling study session callback:', error);
        bot.sendMessage(
            chatId, 
            "❌ Sorry, something went wrong. Please try again later.",
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                }
            }
        );
    }
};

// Handle cancel study session
const handleCancelStudySession = async (bot, users, chatId) => {
    try {
        // Always load fresh user data
        const freshUsers = await loadUsers();
        
        // Ensure consistent string format for chatId
        const chatIdStr = chatId.toString();
        
        // CRITICAL FIX: Always update in-memory users with fresh data
        if (freshUsers[chatIdStr]) {
            users[chatIdStr] = freshUsers[chatIdStr];
        }
        
        const userInfo = users[chatIdStr];
        
        if (!userInfo || !userInfo.studySessions || !userInfo.studySessions.inProgress) {
            return bot.sendMessage(
                chatId,
                "❌ You don't have an active study session to cancel.",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                    }
                }
            );
        }
        
        // Cancel the session
        userInfo.studySessions.inProgress = false;
        await saveUsers(users);
        
        bot.sendMessage(
            chatId,
            "⚠️ Study session cancelled. Remember, consistent studying is key to success!",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📚 Start New Session", callback_data: "study_session" },
                            { text: "🔙 Back to Menu", callback_data: "menu" }
                        ]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error cancelling study session:', error);
        bot.sendMessage(
            chatId, 
            "❌ Sorry, something went wrong. Please try again later.",
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                }
            }
        );
    }
};

// Reward user for completing a study session
const rewardStudySession = async (bot, chatId, userAddress) => {
    try {
        console.log('\n=== Processing Study Session Reward ===');
        console.log('User:', userAddress);

        // Verify environment variables
        verifyEnvironment();
        console.log('Environment variables verified');

        // Validate user address
        if (!ethers.isAddress(userAddress)) {
            throw new Error('Invalid user address format');
        }
        console.log('User address format valid');

        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log('Bot Wallet Address:', botWallet.address);
        console.log('Contract Address:', process.env.SIMBIQUIZMANAGER_CA);

        // Check bot wallet balance
        const botBalance = await provider.getBalance(botWallet.address);
        console.log('Bot Wallet Balance:', ethers.formatEther(botBalance), 'ETH');
        
        if (botBalance < ethers.parseEther('0.01')) {
            throw new Error('Bot wallet has insufficient funds for gas fees');
        }
        console.log('Bot wallet has sufficient balance');

        // Verify contract state
        console.log('Starting contract verification...');
        const contractState = await verifyContractState(provider, process.env.SIMBIQUIZMANAGER_CA, userAddress);
        console.log('Contract verification result:', contractState);
        
        if (!contractState) {
            console.log('Contract verification failed - attempting to register wallet');
            
            // Try to re-register the wallet
            const quizManager = new ethers.Contract(
                process.env.SIMBIQUIZMANAGER_CA,
                QUIZ_MANAGER_ABI,
                botWallet
            );
            
            console.log('Attempting to re-register wallet:', userAddress);
            try {
                const tx = await quizManager.reRegisterWallet(userAddress, {
                    gasLimit: 500000,
                    maxFeePerGas: ethers.parseUnits('1.5', 'gwei'),
                    maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
                });
                
                console.log('Re-registration tx sent:', tx.hash);
                const receipt = await tx.wait();
                console.log('Re-registration complete, status:', receipt.status);
                
                // Verify again
                const newContractState = await verifyContractState(provider, process.env.SIMBIQUIZMANAGER_CA, userAddress);
                console.log('New contract verification result:', newContractState);
                
                if (!newContractState) {
                    throw new Error('Contract verification still failed after re-registration');
                }
            } catch (regError) {
                console.error('Error re-registering wallet:', regError);
                throw new Error('Failed to re-register wallet: ' + regError.message);
            }
        }

        // Initialize quiz manager contract to get token contract address
        const quizManager = new ethers.Contract(
            process.env.SIMBIQUIZMANAGER_CA,
            QUIZ_MANAGER_ABI,
            provider
        );

        // Get token address from QuizManager
        const tokenAddress = await quizManager.token();
        console.log('Token contract address:', tokenAddress);
        
        // Define Token ABI similar to quiz.js
        const TOKEN_ABI = [
            "function mintToUser(address to, uint256 amount) external",
            "function balanceOf(address) external view returns (uint256)",
            "function minters(address) external view returns (bool)",
            "function owner() external view returns (address)",
            "function getUserMinted() external view returns (uint256)",
            "function USER_SUPPLY_CAP() external view returns (uint256)",
            "function getRemainingUserSupply() external view returns (uint256)"
        ];
        
        // Initialize token contract with signer
        const tokenContract = new ethers.Contract(
            tokenAddress,
            TOKEN_ABI,
            botWallet  // Use bot wallet signer for token contract
        );
        
        // Get reward amount from QuizManager (or set fixed amount for study session)
        // Let's use 20 tokens as a fixed reward for study sessions
        const rewardAmount = ethers.parseEther("20");
        
        // Get initial balance
        const initialBalance = await tokenContract.balanceOf(userAddress);
        console.log('Initial token balance:', ethers.formatEther(initialBalance));
        
        // Check remaining supply
        try {
            const remainingSupply = await tokenContract.getRemainingUserSupply();
            console.log('Remaining token supply:', ethers.formatEther(remainingSupply));
            
            if (remainingSupply < rewardAmount) {
                throw new Error('Insufficient token supply for rewards');
            }
        } catch (error) {
            console.log('Could not check remaining supply, proceeding anyway:', error.message);
        }
        
        console.log('Directly minting tokens to user...');
        // MINT DIRECTLY: Call mintToUser function of token contract directly
        const tx = await tokenContract.mintToUser(
            userAddress,
            rewardAmount,
            {
                gasLimit: 500000,
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
                `✅ Study session rewards processed successfully!\n\n` +
                `Reward: 20 SIMBI tokens\n` +
                `New Balance: ${ethers.formatEther(newBalance)} SIMBI\n` +
                `Transaction: https://sepolia.basescan.org/tx/${receipt.hash}`
            );
            return true;
        } else {
            throw new Error(`Transaction failed: ${tx.hash}`);
        }
    } catch (error) {
        console.error('Failed to process study session reward:', error);
        
        // More detailed error logging
        if (error.transaction) {
            console.error('Transaction details:', {
                hash: error.transaction.hash,
                from: error.transaction.from,
                to: error.transaction.to,
                data: error.transaction.data || 'No data',
                nonce: error.transaction.nonce
            });
        }
        
        // Try to extract reason
        const reason = error.reason || 
                       (error.error && error.error.reason) || 
                       (error.data !== '0x' && error.data) || 
                       'Unknown reason';
        console.error('Error reason:', reason);
        
        bot.sendMessage(
            chatId,
            "❌ Failed to process rewards. Please try again later or use /start command to ensure your wallet is registered.",
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                }
            }
        );
        return false;
    }
};

// Check if user has reached a badge milestone
const checkBadgeMilestone = async (bot, chatId, userAddress, completedSessions) => {
    try {
        console.log('\n=== Checking Badge Milestones ===');
        console.log('User:', userAddress);
        console.log('Completed Sessions:', completedSessions);
        
        // Check if user has reached a milestone
        let badgeTier = null;
        if (completedSessions >= 70) {
            badgeTier = 2; // Gold
        } else if (completedSessions >= 50) {
            badgeTier = 1; // Silver
        } else if (completedSessions >= 20) {
            badgeTier = 0; // Bronze
        }
        
        // If no milestone reached, exit
        if (badgeTier === null) {
            return;
        }
        
        // Get badge tier name
        const tierNames = ["Bronze", "Silver", "Gold"];
        const tierName = tierNames[badgeTier];
        
        // Verify environment variables
        verifyEnvironment();
        
        // Initialize provider and wallet
        const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        // Initialize badge NFT contract
        const badgeNFT = new ethers.Contract(
            process.env.SIMBIBADGE_NFT_CA,
            BADGE_NFT_ABI,
            botWallet
        );
        
        // Get current attempt counts
        let bronze = 0, silver = 0, gold = 0;
        let isEligible = false;
        let contractEligibleTier = null;
        
        try {
            [bronze, silver, gold] = await badgeNFT.getAttemptCounts(userAddress);
            console.log('Badge attempts:', { bronze, silver, gold });
            
            // Try to check if eligible via contract
            try {
                contractEligibleTier = await badgeNFT.getEligibleTier(userAddress);
                console.log('Eligible tier from contract:', contractEligibleTier);
                
                // Check if user is eligible for the calculated tier or better
                isEligible = contractEligibleTier >= badgeTier;
            } catch (eligibleError) {
                console.log('Error checking eligible tier:', eligibleError.message);
                
                // IMPROVED ERROR HANDLING: "No eligible tier" is expected for new users
                if (eligibleError.message.includes('No eligible tier')) {
                    console.log('Contract reports user is not eligible for any tier yet');
                    isEligible = false;
                } else {
                    // Fall back to our local calculation
                    console.log('Using local calculation for eligibility');
                    isEligible = true; // We already calculated badgeTier based on sessions
                }
            }
        } catch (error) {
            console.error('Error getting attempt counts:', error);
            // Still proceed with minting attempt if we calculated eligibility locally
            isEligible = true; 
        }
        
        // Update the attempt count in the contract regardless of eligibility
        try {
            // Record attempts based on session completion (score of 100 for all completed sessions)
            console.log('Recording study attempt to badge contract...');
            const recordTx = await badgeNFT.recordQuizAttempt(
                userAddress,
                100, // Perfect score for study sessions
                {
                    gasLimit: 300000n // Increased gas limit to ensure transaction completes
                }
            );
            
            console.log('Attempt record transaction sent:', recordTx.hash);
            const recordReceipt = await recordTx.wait(1);
            console.log('Successfully recorded attempt, tx status:', recordReceipt.status);
            
            // Re-check attempt counts after recording
            try {
                const updatedCounts = await badgeNFT.getAttemptCounts(userAddress);
                console.log('Updated badge attempt counts:', { 
                    bronze: updatedCounts[0], 
                    silver: updatedCounts[1], 
                    gold: updatedCounts[2] 
                });
            } catch (err) {
                console.log('Could not verify updated counts:', err.message);
            }
        } catch (error) {
            console.error('Error recording attempt:', error);
            // Continue to try minting the badge
        }
        
        // Only try to mint the badge if user is eligible
        if (isEligible) {
            try {
                const mintTx = await badgeNFT.safeMint(
                    userAddress,
                    badgeTier,
                    {
                        gasLimit: 300000n
                    }
                );
                
                await bot.sendMessage(
                    chatId,
                    `🏆 Processing your ${tierName} Tier NFT badge...`
                );
                
                const receipt = await mintTx.wait(1);
                
                if (receipt.status === 1) {
                    // Get the badge URI to display the image
                    const baseUri = await badgeNFT.getTierBaseURI(badgeTier);
                    console.log('Badge URI:', baseUri);
                    
                    // Extract IPFS URI 
                    const ipfsUri = baseUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
                    
                    // Send success message with badge info
                    await bot.sendMessage(
                        chatId,
                        `🎖️ Congratulations! You've earned the ${tierName} Tier Badge!\n\n` +
                        `This NFT has been minted to your wallet to commemorate your dedication to learning.\n\n` +
                        `Transaction: https://sepolia.basescan.org/tx/${receipt.hash}`
                    );
                    
                    // Send the badge image
                    try {
                        await bot.sendPhoto(chatId, ipfsUri);
                    } catch (imageError) {
                        console.error('Error sending badge image:', imageError);
                        // Fallback to text message if image sending fails
                        await bot.sendMessage(
                            chatId,
                            `View your badge at: ${ipfsUri}`
                        );
                    }
                }
            } catch (error) {
                console.error('Error minting badge:', error);
                
                // Check if the error is because user already has this badge
                if (error.message.includes('already has badge')) {
                    await bot.sendMessage(
                        chatId,
                        `🏆 You've already earned the ${tierName} Tier Badge! Keep studying to reach the next tier!`
                    );
                } else {
                    await bot.sendMessage(
                        chatId,
                        `ℹ️ You've reached the milestone for a ${tierName} Tier Badge, but there was an issue minting it. The system will try again later.`
                    );
                }
            }
        } else {
            console.log(`User not eligible for ${tierName} tier according to contract checks.`);
        }
    } catch (error) {
        console.error('Error checking badge milestone:', error);
    }
};

// Handle reset study session - new function to help users with stuck sessions
const handleResetStudySession = async (bot, users, chatId) => {
    try {
        console.log('\n=== Reset Study Session Command ===');
        console.log('Chat ID:', chatId);
        
        // Always load fresh user data
        const freshUsers = await loadUsers();
        
        // Ensure consistent string format for chatId
        const chatIdStr = chatId.toString();
        
        // Update in-memory users with fresh data
        if (freshUsers[chatIdStr]) {
            users[chatIdStr] = freshUsers[chatIdStr];
        }
        
        // Get user info from memory
        const userInfo = users[chatIdStr];
        
        if (!userInfo) {
            return bot.sendMessage(
                chatId,
                "❌ No user data found. Please use the /menu command first.",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                    }
                }
            );
        }
        
        // Initialize study sessions if needed
        if (!userInfo.studySessions) {
            userInfo.studySessions = {
                completed: 0,
                inProgress: false,
                history: []
            };
            await saveUsers(users);
            
            return bot.sendMessage(
                chatId,
                "✅ No study session in progress. You can start a new one now.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📚 Start Study Session", callback_data: "study_session" }],
                            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
                        ]
                    }
                }
            );
        }
        
        // Check if there is a study session in progress
        if (!userInfo.studySessions.inProgress) {
            return bot.sendMessage(
                chatId,
                "✅ No study session in progress. You can start a new one now.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📚 Start Study Session", callback_data: "study_session" }],
                            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
                        ]
                    }
                }
            );
        }
        
        // Reset the in-progress session
        userInfo.studySessions.inProgress = false;
        await saveUsers(users);
        
        return bot.sendMessage(
            chatId,
            "✅ Your study session has been reset successfully. You can now start a new one.",
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📚 Start Study Session", callback_data: "study_session" }],
                        [{ text: "🔙 Back to Menu", callback_data: "menu" }]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error resetting study session:', error);
        bot.sendMessage(
            chatId, 
            "❌ Sorry, something went wrong. Please try again later.",
            {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
                }
            }
        );
    }
};

// Export functions
export { handleStudySessionCommand, handleStudySessionCallback, handleCancelStudySession, handleResetStudySession }; 