// Description: This module handles the /trackProgress command and fetches on-chain progress and achievement NFTs for a user.
// It uses the ethers.js library to interact with Ethereum smart contracts and fetch user data.
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path for temporary QR code storage
const QR_CODE_PATH = path.join(process.cwd(), 'temp');

// Create temp directory if it doesn't exist
(async () => {
  try {
    await fs.mkdir(QR_CODE_PATH, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
})();

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIBADGE_NFT_CA:', process.env.SIMBIBADGE_NFT_CA);

// Token ABI for detailed token information
const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// Badge NFT ABI for detailed badge information
const BADGE_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function getAttemptCounts(address user) view returns (uint256, uint256, uint256)",
  "function getEligibleTier(address user) view returns (uint8)",
  "function getBadgeTier(uint256 tokenId) view returns (uint8)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

// QuizManager ABI for study metrics
const QUIZ_MANAGER_ABI = [
  "function completedQuizzes(address) view returns (uint256)",
  "function quizScores(address) view returns (uint256)",
  // Add alternative function names
  "function getUserQuizCount(address) view returns (uint256)",
  "function getUserScore(address) view returns (uint256)"
];

// Generate a shareable link for tracking progress
const generateProgressLink = async (userAddress) => {
  // Create a Base Sepolia explorer URL for the user's wallet
  const explorerUrl = `https://sepolia.basescan.org/address/${userAddress}`;
  
  // Generate QR code for the explorer URL
  const qrCodeFilename = `${userAddress.substring(2, 10)}_progress.png`;
  const qrCodeFilePath = path.join(QR_CODE_PATH, qrCodeFilename);
  
  try {
    await QRCode.toFile(qrCodeFilePath, explorerUrl, {
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      width: 300,
      margin: 1
    });
    return { explorerUrl, qrCodeFilePath };
  } catch (error) {
    console.error('Error generating QR code:', error);
    return { explorerUrl, qrCodeFilePath: null };
  }
};

// Improved function to get badge progress safely
const getBadgeProgressSafely = async (provider, simbiBadgeNFT, userAddress, userInfo) => {
  console.log('Getting badge progress data safely');
  
  // Default fallback values
  let result = {
    bronze: 0,
    silver: 0,
    gold: 0,
    nftCount: 0,
    eligibleTier: null
  };
  
  try {
    // 1. First try to get the attempt counts - this should always work
    const [bronze, silver, gold] = await simbiBadgeNFT.getAttemptCounts(userAddress);
    result.bronze = bronze;
    result.silver = silver;
    result.gold = gold;
    console.log('Success getting attempt counts:', { bronze, silver, gold });
    
    // 2. Try to get NFT count separately
    try {
      const nftCount = await simbiBadgeNFT.balanceOf(userAddress);
      result.nftCount = nftCount;
      console.log('Success getting NFT count:', nftCount);
    } catch (error) {
      console.error('Failed to get NFT count:', error);
    }
    
    // 3. Try to get eligible tier in a separate try/catch
    try {
      const eligibleTier = await simbiBadgeNFT.getEligibleTier(userAddress);
      result.eligibleTier = eligibleTier;
      console.log('Success getting eligible tier:', eligibleTier);
    } catch (error) {
      console.log('Error getting eligible tier:', error.message);
      
      // Check if this is the expected "no eligible tier" error
      if (error.message.includes('No eligible tier') || error.message.includes('execution reverted')) {
        console.log('User is not eligible for any tier yet - this is expected for new users');
        result.eligibleTier = null; // Set explicitly to null
      } else {
        console.error('Unexpected error getting eligible tier:', error);
      }
      
      // Calculate eligibility based on completed sessions as fallback
      const completedSessions = userInfo?.studySessions?.completed || 0;
      if (completedSessions >= 70) {
        result.eligibleTier = 2; // Gold
      } else if (completedSessions >= 50) {
        result.eligibleTier = 1; // Silver
      } else if (completedSessions >= 20) {
        result.eligibleTier = 0; // Bronze
      }
      console.log('Estimated eligibleTier from sessions:', result.eligibleTier);
    }
  } catch (error) {
    console.error('Failed to get badge data, using fallback approach:', error);
    
    // Fallback to session count for display
    const completedSessions = userInfo?.studySessions?.completed || 0;
    
    // Same logic for both progress and achievements
    result.bronze = completedSessions; // 1:1 ratio  
    result.silver = Math.floor(completedSessions * 0.7); // conservative estimate
    result.gold = Math.floor(completedSessions * 0.5); // conservative estimate
  }
  
  return result;
};

const handleTrackProgressCommand = async (bot, users, chatId) => {
  try {
    // Debug the users object
    console.log(`TrackProgress - Chat ID: ${chatId}, Users keys:`, Object.keys(users));
    console.log(`User data exists: ${!!users[chatId]}`);
    if (users[chatId]) {
      console.log(`User has wallet: ${!!users[chatId].address}, Wallet: ${users[chatId].address}`);
    }
    
    const SIMBI_CONTRACT_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    // First ensure we stringify the chatId for consistency
    const userChatId = chatId.toString();
    const userAddress = users[userChatId]?.address;

    if (!userAddress) {
      console.error('No wallet address found for user', userChatId);
      return bot.sendMessage(
        chatId, 
        '❗ Wallet data not found. Please go back to Menu and then retry.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Reload Data", callback_data: "menu" }],
              [{ text: "💼 Create Wallet", callback_data: "start_wallet" }]
            ]
          }
        }
      );
    }

    // Validate contract addresses
    if (!SIMBI_CONTRACT_ADDRESS || !SIMBIBADGE_NFT_CA || !SIMBIQUIZMANAGER_CA) {
      console.error('One or more contract addresses missing');
      return bot.sendMessage(
        chatId, 
        '⚠️ Configuration error: Contract addresses missing. Please contact support.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Send initial message while fetching data
    await bot.sendMessage(chatId, '🔍 *Fetching your on-chain progress...*', { parse_mode: 'Markdown' });

    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    
    // Initialize contracts
    const simbiToken = new ethers.Contract(
      SIMBI_CONTRACT_ADDRESS,
      TOKEN_ABI,
      provider
    );
    
    const simbiBadgeNFT = new ethers.Contract(
      SIMBIBADGE_NFT_CA,
      BADGE_NFT_ABI,
      provider
    );
    
    const quizManager = new ethers.Contract(
      SIMBIQUIZMANAGER_CA,
      QUIZ_MANAGER_ABI,
      provider
    );

    // Fetch token data
    const [
      tokenBalance, 
      decimals,
      symbol
    ] = await Promise.all([
      simbiToken.balanceOf(userAddress),
      simbiToken.decimals(),
      simbiToken.symbol()
    ]);

    // Fetch quiz stats using try/catch to attempt different function names
    let completedQuizzes = 0;
    let quizScores = 0;
    
    try {
      // First try original function names
      try {
        [completedQuizzes, quizScores] = await Promise.all([
          quizManager.completedQuizzes(userAddress),
          quizManager.quizScores(userAddress)
        ]);
      } catch (error) {
        console.log('Primary quiz stats functions not found, trying alternatives');
        [completedQuizzes, quizScores] = await Promise.all([
          quizManager.getUserQuizCount(userAddress),
          quizManager.getUserScore(userAddress)
        ]);
      }
    } catch (error) {
      console.log('Error fetching quiz stats:', error);
      // Use local data as fallback
      completedQuizzes = users[chatId]?.completedQuizzes || 0;
      quizScores = users[chatId]?.quizScore || 0;
    }

    // Calculate formatted token balance
    const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
    
    // Get NFT badge data using the shared function
    const badgeData = await getBadgeProgressSafely(provider, simbiBadgeNFT, userAddress, users[userChatId]);
    
    // Generate shareable progress link and QR code
    const { explorerUrl, qrCodeFilePath } = await generateProgressLink(userAddress);

    // Generate user's progress summary
    const progressSummary = `
📊 *SIMBI On-Chain Progress Report*

👤 *Wallet Address:* \`${userAddress}\`

💰 *Token Holdings:*
• ${formattedBalance} ${symbol}

🏆 *Study Achievements:*
• Total Quiz Completions: ${completedQuizzes.toString()}
• Study Sessions: ${users[chatId]?.studySessions?.completed || 0}
• Cumulative Quiz Score: ${quizScores.toString()}

🏅 *NFT Badges:*
• Total Badges: ${badgeData.nftCount.toString()}
• Bronze Tier Progress: ${badgeData.bronze.toString()}/20
• Silver Tier Progress: ${badgeData.silver.toString()}/50
• Gold Tier Progress: ${badgeData.gold.toString()}/70

🔗 *Cross-Platform Access:*
• View on blockchain explorer: [Explorer](${explorerUrl})
• Scan the QR code to view on mobile
`;

    // Send progress information with Back to Menu button
    await bot.sendMessage(
      chatId, 
      progressSummary, 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Refresh", callback_data: "progress" },
              { text: "🏅 View Badge NFTs", callback_data: "achievements" }
            ],
            [
              { text: "📱 Share Progress", callback_data: "share_progress" },
              { text: "🔙 Back to Menu", callback_data: "menu" }
            ]
          ]
        }
      }
    );

    // Send QR code if generated successfully
    if (qrCodeFilePath) {
      await bot.sendPhoto(
        chatId, 
        qrCodeFilePath, 
        { 
          caption: "🔍 Scan this QR code to view your progress on any device"
        }
      );
      
      // Clean up QR code file
      try {
        await fs.unlink(qrCodeFilePath);
      } catch (error) {
        console.error('Error deleting QR code file:', error);
      }
    }

  } catch (error) {
    console.error('Error tracking progress:', error);
    
    bot.sendMessage(
      chatId, 
      '⚠️ Failed to fetch your on-chain progress. Please try again later.', 
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

const handleAchievementNFTs = async (bot, users, chatId) => {
  try {
    console.log(`AchievementNFTs - Chat ID: ${chatId}, Users keys:`, Object.keys(users));
    
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    // First ensure we stringify the chatId for consistency
    const userChatId = chatId.toString();
    const userAddress = users[userChatId]?.address;

    if (!userAddress) {
      console.error('No wallet address found for user', userChatId);
      return bot.sendMessage(
        chatId, 
        '❗ Wallet data not found. Please go back to Menu and then retry. If you havent created a wallet yet, use /start_wallet',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Reload Data", callback_data: "menu" }],
              [{ text: "💼 Create Wallet", callback_data: "start_wallet" }]
            ]
          }
        }
      );
    }

    if (!SIMBIBADGE_NFT_CA) {
      console.error('SIMBIBADGE_NFT_CA is not defined or invalid.');
      return bot.sendMessage(
        chatId, 
        '⚠️ Configuration error: NFT contract address is missing. Please contact support.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Send loading message
    await bot.sendMessage(chatId, '🔍 *Fetching your achievement NFTs...*', { parse_mode: 'Markdown' });

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    const simbiBadgeNFT = new ethers.Contract(
      SIMBIBADGE_NFT_CA,
      BADGE_NFT_ABI,
      provider
    );

    // Get NFT badge data using the shared function
    const badgeData = await getBadgeProgressSafely(provider, simbiBadgeNFT, userAddress, users[userChatId]);
    
    // Generate NFT achievement message
    let nftMessage = `🏅 *Your Achievement NFTs*\n\n`;
    
    // Bronze tier progress
    nftMessage += `🥉 *Bronze Tier Badge:*\n`;
    nftMessage += badgeData.bronze >= 20 ? `✅ Earned! (${badgeData.bronze}/20)\n\n` : `⏳ Progress: ${badgeData.bronze}/20\n\n`;
    
    // Silver tier progress
    nftMessage += `🥈 *Silver Tier Badge:*\n`;
    nftMessage += badgeData.silver >= 50 ? `✅ Earned! (${badgeData.silver}/50)\n\n` : `⏳ Progress: ${badgeData.silver}/50\n\n`;
    
    // Gold tier progress
    nftMessage += `🥇 *Gold Tier Badge:*\n`;
    nftMessage += badgeData.gold >= 70 ? `✅ Earned! (${badgeData.gold}/70)\n\n` : `⏳ Progress: ${badgeData.gold}/70\n\n`;
    
    // Add total NFT count
    nftMessage += `🎖️ *Total NFT Badges:* ${badgeData.nftCount}\n\n`;
    
    // Set up the response buttons
    const buttons = [];
    
    // Add Mint NFT Button if eligible for any tier
    if (badgeData.eligibleTier !== null) {
      // Find the highest eligible tier
      let tierName;
      if (badgeData.eligibleTier === 2) {
        tierName = "Gold";
      } else if (badgeData.eligibleTier === 1) {
        tierName = "Silver";
      } else {
        tierName = "Bronze";
      }
      
      nftMessage += `✨ *Achievement Unlocked!* You are eligible for the ${tierName} Tier Badge!\n\n`;
      
      // Add mint button for eligible tier
      buttons.push([{ text: `🎖️ Mint ${tierName} NFT Badge`, callback_data: `mint_badge_${badgeData.eligibleTier}` }]);
    } else {
      nftMessage += `🔍 Complete more study sessions and quizzes to earn badges!`;
    }
    
    // Add standard navigation buttons
    buttons.push([
      { text: "📊 View Full Progress", callback_data: "progress" },
      { text: "🔙 Back to Menu", callback_data: "menu" }
    ]);

    // Send achievements with buttons
    await bot.sendMessage(
      chatId, 
      nftMessage, 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  } catch (error) {
    console.error('Error fetching achievement NFTs:', error);
    bot.sendMessage(
      chatId, 
      '⚠️ Failed to fetch achievement NFTs. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

// Handle share progress callback
const handleShareProgress = async (bot, users, chatId) => {
  try {
    console.log(`ShareProgress - Chat ID: ${chatId}, Users keys:`, Object.keys(users));
    
    // First ensure we stringify the chatId for consistency
    const userChatId = chatId.toString();
    const userAddress = users[userChatId]?.address;
    
    if (!userAddress) {
      console.error('No wallet address found for user', userChatId);
      return bot.sendMessage(
        chatId, 
        '❗ Wallet data not found. Please go back to Menu and then retry.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Reload Data", callback_data: "menu" }],
              [{ text: "💼 Create Wallet", callback_data: "start_wallet" }]
            ]
          }
        }
      );
    }
    
    // Generate shareable progress link
    const { explorerUrl, qrCodeFilePath } = await generateProgressLink(userAddress);
    
    // Create message with share options
    const shareMessage = `
📱 *Share Your Progress*

Share your SIMBI learning journey with friends or access your progress from any device:

🔗 *Shareable Link:*
${explorerUrl}

🧠 *Access Methods:*
• Scan the QR code with your mobile device
• Copy/Click on the link to view in any browser
• Import your wallet in any Web3 wallet app (eg. MetaMask, etc...)

💡 *Cross-Platform Access:*
Your on-chain progress is stored on the blockchain and can be accessed from any device or platform!
`;

    // Send share options
    await bot.sendMessage(
      chatId, 
      shareMessage, 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
    
    // Send QR code if generated successfully
    if (qrCodeFilePath) {
      await bot.sendPhoto(
        chatId, 
        qrCodeFilePath, 
        { 
          caption: "🔍 Scan this QR code to view your progress on any device"
        }
      );
      
      // Clean up QR code file
      try {
        await fs.unlink(qrCodeFilePath);
      } catch (error) {
        console.error('Error deleting QR code file:', error);
      }
    }
  } catch (error) {
    console.error('Error sharing progress:', error);
    bot.sendMessage(
      chatId, 
      '⚠️ Failed to generate shareable progress. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

// Handle minting NFT badges
const mintNFTBadge = async (bot, users, chatId, tier) => {
  try {
    console.log(`Minting NFT Badge - Chat ID: ${chatId}, Tier: ${tier}`);
    
    // Environment variables
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    // First ensure we stringify the chatId for consistency
    const userChatId = chatId.toString();
    const userAddress = users[userChatId]?.address;

    if (!userAddress) {
      console.error('No wallet address found for user', userChatId);
      return bot.sendMessage(
        chatId, 
        '❗ Wallet data not found. Please go back to Menu and then retry.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Validate environment variables
    if (!SIMBIBADGE_NFT_CA || !BASE_SEPOLIA_RPC_URL || !PRIVATE_KEY) {
      console.error('Missing required environment variables for NFT minting');
      return bot.sendMessage(
        chatId, 
        '⚠️ Configuration error: Missing contract information. Please contact support.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    // Validate tier
    if (tier < 0 || tier > 2) {
      return bot.sendMessage(
        chatId, 
        '❌ Invalid badge tier specified.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    // Get tier name for messages
    const tierNames = ["Bronze", "Silver", "Gold"];
    const tierName = tierNames[tier];
    
    // Send initial message
    await bot.sendMessage(
      chatId,
      `🏅 *Minting ${tierName} Tier Badge*\n\nPreparing your NFT badge...`,
      { parse_mode: 'Markdown' }
    );
    
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Initialize badge NFT contract
    const badgeNFT = new ethers.Contract(
      SIMBIBADGE_NFT_CA,
      BADGE_NFT_ABI,
      botWallet
    );
    
    // Verify user is eligible for the specified tier
    try {
      const eligibleTier = await badgeNFT.getEligibleTier(userAddress);
      console.log(`User is eligible for tier: ${eligibleTier}`);
      
      if (eligibleTier < tier) {
        return bot.sendMessage(
          chatId,
          `❌ You are not eligible for the ${tierName} Tier Badge yet.\n\nKeep completing study sessions to unlock this badge!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📊 View Progress", callback_data: "progress" }],
                [{ text: "🔙 Back to Menu", callback_data: "menu" }]
              ]
            }
          }
        );
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      
      // Check if error is "No eligible tier"
      if (error.message.includes('No eligible tier')) {
        return bot.sendMessage(
          chatId,
          `❌ You are not eligible for any badge tier yet.\n\nComplete more study sessions to earn badges! You need at least 20 completed sessions for Bronze tier.`,
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
      
      // If we can't verify eligibility due to other errors, try to mint anyway
      // The contract should have its own checks in place
      console.log('Proceeding with mint attempt despite eligibility check failure');
    }
    
    // Attempt to mint the NFT
    try {
      const tx = await badgeNFT.safeMint(
        userAddress,
        tier,
        {
          gasLimit: 500000n,
          maxFeePerGas: ethers.parseUnits('2', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
        }
      );
      
      console.log('Mint transaction sent:', tx.hash);
      
      // Notify user of pending transaction
      await bot.sendMessage(
        chatId,
        `🔄 Minting your ${tierName} Tier Badge...\n\nTransaction: https://sepolia.basescan.org/tx/${tx.hash}`
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait(1);
      console.log('Mint transaction confirmed:', receipt.hash);
      
      if (receipt.status === 1) {
        // Try to get the badge URI or image if available
        let badgeImage = null;
        try {
          // Get latest token ID (could be different depending on contract implementation)
          const nftBalance = await badgeNFT.balanceOf(userAddress);
          const baseUri = await badgeNFT.getTierBaseURI(tier);
          
          // Extract IPFS URI if available
          if (baseUri) {
            badgeImage = baseUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }
        } catch (error) {
          console.error('Error getting badge image:', error);
        }
        
        // Success message
        await bot.sendMessage(
          chatId,
          `✅ *Congratulations!*\n\nYour ${tierName} Tier Badge has been successfully minted!\n\nThis NFT has been added to your wallet and will be visible in your Achievement NFTs section.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🏅 View Achievements", callback_data: "achievements" },
                  { text: "📊 View Progress", callback_data: "progress" }
                ],
                [{ text: "🔙 Back to Menu", callback_data: "menu" }]
              ]
            }
          }
        );
        
        // Send badge image if available
        if (badgeImage) {
          try {
            await bot.sendPhoto(
              chatId,
              badgeImage,
              { caption: `🏅 Your ${tierName} Tier Badge` }
            );
          } catch (imageError) {
            console.error('Error sending badge image:', imageError);
          }
        }
        
        return true;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Error minting NFT badge:', error);
      
      // Handle specific error cases
      let errorMessage = '❌ Failed to mint NFT badge. ';
      
      if (error.message.includes('already has badge')) {
        errorMessage = `You already own the ${tierName} Tier Badge.`;
      } else if (error.message.includes('not eligible')) {
        errorMessage = `You are not eligible for the ${tierName} Tier Badge yet. Keep completing study sessions!`;
      } else if (error.message.includes('execution reverted')) {
        errorMessage += 'The transaction was rejected by the blockchain.';
      } else {
        errorMessage += 'Please try again later.';
      }
      
      await bot.sendMessage(
        chatId,
        errorMessage,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
      
      return false;
    }
    
  } catch (error) {
    console.error('Error in mintNFTBadge:', error);
    bot.sendMessage(
      chatId, 
      '⚠️ An error occurred while minting your badge. Please try again later.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
    return false;
  }
};

export { handleTrackProgressCommand, handleAchievementNFTs, handleShareProgress, mintNFTBadge };