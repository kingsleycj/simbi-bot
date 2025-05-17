// Description: This module handles the /trackProgress command and fetches on-chain progress and achievement NFTs for a user.
// It uses the ethers.js library to interact with Ethereum smart contracts and fetch user data.
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getUser } from '../db-adapter.js';

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
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getTierBaseURI(uint8 tier) view returns (string memory)",
  "function safeMint(address to, uint8 tier)"
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

const handleTrackProgressCommand = async (bot, users, chatId) => {
  try {
    // Debug logged information
    console.log(`TrackProgress - Chat ID: ${chatId}`);
    
    const SIMBI_CONTRACT_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    // Ensure chatId is a string and get user data from database
    const userChatId = chatId.toString();
    const userInfo = await getUser(userChatId);
    
    console.log(`User data exists: ${!!userInfo}`);
    if (userInfo) {
      console.log(`User has wallet: ${!!userInfo.walletAddress}, Wallet: ${userInfo.walletAddress}`);
    }
    
    // Get wallet address from user data
    const userAddress = userInfo?.walletAddress;

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

    // Get quiz scores from user data in the database
    const completedQuizzes = userInfo?.completedQuizzes || 0;
    const quizScore = userInfo?.quizScore || 0;
    console.log('Local quiz data:', { completedQuizzes, quizScore });

    // Fetch quiz stats using try/catch to attempt different function names
    // This section is now redundant since we're using the local data
    // Keeping it as a fallback only for extreme cases
    let onChainQuizStats = false;
    try {
      // IMPROVED QUIZ DATA FETCHING: Try multiple approaches to get the data
      console.log('Attempting to fetch quiz data from contract...');
      
      // First try original function names
      try {
        const onChainCompletedQuizzes = await quizManager.completedQuizzes(userAddress);
        const onChainQuizScores = await quizManager.quizScores(userAddress);
        console.log('Successfully fetched quiz stats using primary functions:', { 
          onChainCompletedQuizzes, 
          onChainQuizScores 
        });
        onChainQuizStats = true;
      } catch (error) {
        console.log('Primary quiz stats functions failed, trying alternatives:', error.message);
        try {
          const onChainCompletedQuizzes = await quizManager.getUserQuizCount(userAddress);
          const onChainQuizScores = await quizManager.getUserScore(userAddress);
          console.log('Successfully fetched quiz stats using alternative functions:', { 
            onChainCompletedQuizzes, 
            onChainQuizScores 
          });
          onChainQuizStats = true;
        } catch (altError) {
          throw new Error(`Both primary and alternative quiz stat fetching failed: ${altError.message}`);
        }
      }
    } catch (error) {
      console.log('Error fetching quiz stats from contract:', error);
      console.log('Using local quiz data as fallback:', { completedQuizzes, quizScore });
    }

    // Calculate formatted token balance
    const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
    
    // COMPLETELY REVISED NFT BADGE DATA FETCHING
    console.log('Fetching NFT badge data...');
    let bronze = 0, silver = 0, gold = 0;
    let nftCount = 0;
    let eligibleTier = null;

    try {
      // Get NFT balance first - this should always work
      nftCount = await simbiBadgeNFT.balanceOf(userAddress);
      console.log('NFT balance retrieved successfully:', nftCount.toString());
      
      // Get attempt counts using a more robust approach
      try {
        const attemptCounts = await simbiBadgeNFT.getAttemptCounts(userAddress);
        console.log('Raw attempt counts from contract:', attemptCounts);
        console.log('Type of attempt counts:', typeof attemptCounts);
        console.log('Is array?', Array.isArray(attemptCounts));
        
        // More defensive approach to handle different return types
        if (Array.isArray(attemptCounts)) {
          // Handle Array return type
          console.log('Processing array type response');
          try {
            bronze = Number(attemptCounts[0].toString()) || 0;
            silver = Number(attemptCounts[1].toString()) || 0;
            gold = Number(attemptCounts[2].toString()) || 0;
          } catch (convError) {
            console.error('Error converting array values:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else if (attemptCounts && typeof attemptCounts === 'object') {
          // Handle object return type with named properties or numeric indices
          console.log('Processing object type response');
          try {
            // Try to access values safely
            bronze = attemptCounts.bronze ? Number(attemptCounts.bronze.toString()) : 
                    (attemptCounts[0] ? Number(attemptCounts[0].toString()) : 0);
            silver = attemptCounts.silver ? Number(attemptCounts.silver.toString()) : 
                    (attemptCounts[1] ? Number(attemptCounts[1].toString()) : 0);
            gold = attemptCounts.gold ? Number(attemptCounts.gold.toString()) : 
                    (attemptCounts[2] ? Number(attemptCounts[2].toString()) : 0);
          } catch (convError) {
            console.error('Error converting object values:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else if (attemptCounts && typeof attemptCounts.toString === 'function') {
          // Handle single return value (unlikely but possible)
          console.log('Processing single value response');
          try {
            bronze = Number(attemptCounts.toString()) || 0;
            silver = bronze;
            gold = bronze;
          } catch (convError) {
            console.error('Error converting single value:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else {
          console.log('Unknown return type, setting counts to 0');
          bronze = 0;
          silver = 0;
          gold = 0;
        }
        
        console.log('Parsed badge attempt counts:', { bronze, silver, gold });
      } catch (attemptError) {
        console.error('Error getting attempt counts:', attemptError);
        
        // Better fallback - don't throw, use local data instead
        const completedSessions = userInfo?.studySessions?.completed || 0;
        console.log('Using local study sessions as fallback:', completedSessions);
        bronze = completedSessions;
        silver = completedSessions;
        gold = completedSessions;
      }
      
      // Try to get eligible tier with proper error handling
      try {
        const rawEligibleTier = await simbiBadgeNFT.getEligibleTier(userAddress);
        console.log('Successfully retrieved eligible tier:', rawEligibleTier);
        console.log('Type of eligible tier:', typeof rawEligibleTier);
        
        // Convert from BigInt/Number object safely
        try {
          eligibleTier = Number(rawEligibleTier.toString());
          console.log('Converted eligible tier to number:', eligibleTier);
        } catch (convError) {
          console.error('Error converting eligible tier:', convError);
          // Calculate based on session counts
          if (gold >= 70) eligibleTier = 2;
          else if (silver >= 50) eligibleTier = 1;
          else if (bronze >= 20) eligibleTier = 0;
          else eligibleTier = null;
        }
      } catch (eligibleError) {
        console.log('Error getting eligible tier:', eligibleError.message);
        
        // "No eligible tier" is expected for new users
        if (eligibleError.message.includes('No eligible tier')) {
          console.log('No eligible tier is an expected state for new users');
          eligibleTier = null;
        } else {
          console.warn('Unexpected error when checking eligibility:', eligibleError);
          
          // Calculate eligibility based on retrieved attempt counts
          if (gold >= 70) eligibleTier = 2;
          else if (silver >= 50) eligibleTier = 1;
          else if (bronze >= 20) eligibleTier = 0;
          else eligibleTier = null;
          
          console.log('Calculated eligibility from counts:', eligibleTier);
        }
      }
      
    } catch (error) {
      console.error('Error fetching badge data from contract:', error);
      
      // IMPROVED FALLBACK: Use actual completed sessions for all tiers
      const completedSessions = userInfo?.studySessions?.completed || 0;
      console.log('Using local data as fallback - completed sessions:', completedSessions);
      
      bronze = completedSessions;
      silver = completedSessions;
      gold = completedSessions;
      
      // Recalculate eligibility with local data
      if (completedSessions >= 70) eligibleTier = 2;
      else if (completedSessions >= 50) eligibleTier = 1;
      else if (completedSessions >= 20) eligibleTier = 0;
      else eligibleTier = null;
      
      console.log('Calculated local eligibility:', eligibleTier);
    }

    // Generate shareable progress link and QR code
    const { explorerUrl, qrCodeFilePath } = await generateProgressLink(userAddress);

    // Generate user's progress summary with improved formatting
    const progressSummary = `
📊 *SIMBI On-Chain Progress Report*

👤 *Wallet Address:* \`${userAddress}\`

💰 *Token Holdings:*
• ${formattedBalance} ${symbol}

🏆 *Study Achievements:*
• Total Quiz Completions: ${completedQuizzes}
• Study Sessions: ${userInfo?.studySessions?.completed || 0}
• Cumulative Quiz Score: ${quizScore}

🏅 *NFT Badges Progress:*
• Total Badges Owned: ${nftCount}
• Bronze Tier Progress: ${bronze}/20
• Silver Tier Progress: ${silver}/50
• Gold Tier Progress: ${gold}/70
${eligibleTier !== null ? `\n✨ You are eligible for the ${eligibleTier === 0 ? 'Bronze' : eligibleTier === 1 ? 'Silver' : 'Gold'} Tier Badge!` : ''}

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
    console.log(`AchievementNFTs - Chat ID: ${chatId}`);
    
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    // Ensure chatId is a string and get user data from database
    const userChatId = chatId.toString();
    const userInfo = await getUser(userChatId);
    
    console.log(`User data exists: ${!!userInfo}`);
    if (userInfo) {
      console.log(`User has wallet: ${!!userInfo.walletAddress}, Wallet: ${userInfo.walletAddress}`);
    }
    
    // Get wallet address from user data
    const userAddress = userInfo?.walletAddress;

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

    // COMPLETELY REVISED NFT BADGE DATA FETCHING for achievements
    console.log('Fetching NFT badge achievement data...');
    let bronze = 0, silver = 0, gold = 0;
    let nftBalance = 0;
    let eligibleTier = null;
    
    // Get quiz scores from user data
    const completedQuizzes = userInfo?.completedQuizzes || 0;
    const quizScore = userInfo?.quizScore || 0;
    console.log('Using quiz data for achievements:', { completedQuizzes, quizScore });

    try {
      // Get NFT balance first - this should always work
      nftBalance = await simbiBadgeNFT.balanceOf(userAddress);
      console.log('NFT balance retrieved successfully:', nftBalance.toString());
      
      // Get attempt counts using a more robust approach
      try {
        const attemptCounts = await simbiBadgeNFT.getAttemptCounts(userAddress);
        console.log('Raw attempt counts from contract:', attemptCounts);
        console.log('Type of attempt counts:', typeof attemptCounts);
        console.log('Is array?', Array.isArray(attemptCounts));
        
        // More defensive approach to handle different return types
        if (Array.isArray(attemptCounts)) {
          // Handle Array return type
          console.log('Processing array type response');
          try {
            bronze = Number(attemptCounts[0].toString()) || 0;
            silver = Number(attemptCounts[1].toString()) || 0;
            gold = Number(attemptCounts[2].toString()) || 0;
          } catch (convError) {
            console.error('Error converting array values:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else if (attemptCounts && typeof attemptCounts === 'object') {
          // Handle object return type with named properties or numeric indices
          console.log('Processing object type response');
          try {
            // Try to access values safely
            bronze = attemptCounts.bronze ? Number(attemptCounts.bronze.toString()) : 
                    (attemptCounts[0] ? Number(attemptCounts[0].toString()) : 0);
            silver = attemptCounts.silver ? Number(attemptCounts.silver.toString()) : 
                    (attemptCounts[1] ? Number(attemptCounts[1].toString()) : 0);
            gold = attemptCounts.gold ? Number(attemptCounts.gold.toString()) : 
                    (attemptCounts[2] ? Number(attemptCounts[2].toString()) : 0);
          } catch (convError) {
            console.error('Error converting object values:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else if (attemptCounts && typeof attemptCounts.toString === 'function') {
          // Handle single return value (unlikely but possible)
          console.log('Processing single value response');
          try {
            bronze = Number(attemptCounts.toString()) || 0;
            silver = bronze;
            gold = bronze;
          } catch (convError) {
            console.error('Error converting single value:', convError);
            bronze = 0;
            silver = 0;
            gold = 0;
          }
        } else {
          console.log('Unknown return type, setting counts to 0');
          bronze = 0;
          silver = 0;
          gold = 0;
        }
        
        console.log('Parsed badge attempt counts:', { bronze, silver, gold });
      } catch (attemptError) {
        console.error('Error getting attempt counts:', attemptError);
        
        // Better fallback - don't throw, use local data instead
        const completedSessions = userInfo?.studySessions?.completed || 0;
        console.log('Using local study sessions as fallback:', completedSessions);
        bronze = completedSessions;
        silver = completedSessions;
        gold = completedSessions;
      }
      
      // Try to get eligible tier with proper error handling
      try {
        eligibleTier = await simbiBadgeNFT.getEligibleTier(userAddress);
        console.log('Successfully retrieved eligible tier:', eligibleTier);
        console.log('Type of eligible tier:', typeof eligibleTier);
        
        // Convert from BigInt/Number object safely
        try {
          eligibleTier = Number(eligibleTier.toString());
          console.log('Converted eligible tier to number:', eligibleTier);
        } catch (convError) {
          console.error('Error converting eligible tier:', convError);
          // Calculate based on session counts
          if (gold >= 70) eligibleTier = 2;
          else if (silver >= 50) eligibleTier = 1;
          else if (bronze >= 20) eligibleTier = 0;
          else eligibleTier = null;
        }
      } catch (eligibleError) {
        console.log('Error getting eligible tier:', eligibleError.message);
        
        // "No eligible tier" is expected for new users
        if (eligibleError.message.includes('No eligible tier')) {
          console.log('No eligible tier is an expected state for new users');
          eligibleTier = null;
        } else {
          console.warn('Unexpected error when checking eligibility:', eligibleError);
          
          // Calculate eligibility based on retrieved attempt counts
          if (gold >= 70) eligibleTier = 2;
          else if (silver >= 50) eligibleTier = 1;
          else if (bronze >= 20) eligibleTier = 0;
          else eligibleTier = null;
          
          console.log('Calculated eligibility from counts:', eligibleTier);
        }
      }
      
    } catch (error) {
      console.error('Error fetching badge data from contract:', error);
      
      // IMPROVED FALLBACK: Use actual completed sessions for all tiers
      const completedSessions = userInfo?.studySessions?.completed || 0;
      console.log('Using local data as fallback - completed sessions:', completedSessions);
      
      bronze = completedSessions;
      silver = completedSessions;
      gold = completedSessions;
      
      // Recalculate eligibility with local data
      if (completedSessions >= 70) eligibleTier = 2;
      else if (completedSessions >= 50) eligibleTier = 1;
      else if (completedSessions >= 20) eligibleTier = 0;
      else eligibleTier = null;
      
      console.log('Calculated local eligibility:', eligibleTier);
    }
    
    // Generate NFT achievement message with improved formatting
    let nftMessage = `🏅 *Your Achievement NFTs*\n\n`;
    
    // Add quiz stats section
    nftMessage += `📊 *Quiz Achievements:*\n`;
    nftMessage += `• Completed Quizzes: ${completedQuizzes}\n`;
    nftMessage += `• Cumulative Quiz Score: ${quizScore}\n\n`;
    
    // Bronze tier progress
    nftMessage += `🥉 *Bronze Tier Badge:*\n`;
    nftMessage += bronze >= 20 ? `✅ Earned! (${bronze}/20)\n\n` : `⏳ Progress: ${bronze}/20\n\n`;
    
    // Silver tier progress
    nftMessage += `🥈 *Silver Tier Badge:*\n`;
    nftMessage += silver >= 50 ? `✅ Earned! (${silver}/50)\n\n` : `⏳ Progress: ${silver}/50\n\n`;
    
    // Gold tier progress
    nftMessage += `🥇 *Gold Tier Badge:*\n`;
    nftMessage += gold >= 70 ? `✅ Earned! (${gold}/70)\n\n` : `⏳ Progress: ${gold}/70\n\n`;
    
    // Add total NFT count
    nftMessage += `🎖️ *Total NFT Badges Owned:* ${nftBalance}\n\n`;
    
    // Set up the response buttons
    const buttons = [];
    
    // Add Mint NFT Button if eligible for any tier
    if (eligibleTier !== null) {
      // Find the highest eligible tier
      let tierName;
      if (eligibleTier === 2) {
        tierName = "Gold";
      } else if (eligibleTier === 1) {
        tierName = "Silver";
      } else {
        tierName = "Bronze";
      }
      
      nftMessage += `✨ *Achievement Unlocked!* You are eligible for the ${tierName} Tier Badge!\n\n`;
      
      // Add mint button for eligible tier
      buttons.push([{ text: `🎖️ Mint ${tierName} NFT Badge`, callback_data: `mint_badge_${eligibleTier}` }]);
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
    console.log(`ShareProgress - Chat ID: ${chatId}`);
    
    // Ensure chatId is a string and get user data from database
    const userChatId = chatId.toString();
    const userInfo = await getUser(userChatId);
    
    if (!userInfo || !userInfo.walletAddress) {
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
    const { explorerUrl, qrCodeFilePath } = await generateProgressLink(userInfo.walletAddress);
    
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

    // Ensure chatId is a string and get user data from database
    const userChatId = chatId.toString();
    const userInfo = await getUser(userChatId);

    if (!userInfo || !userInfo.walletAddress) {
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
    
    // Log blockchain connection details for debugging
    console.log('NFT Minting - Blockchain connection details:');
    console.log('Contract Address:', SIMBIBADGE_NFT_CA);
    console.log('RPC URL:', BASE_SEPOLIA_RPC_URL ? 'Set' : 'Missing');
    console.log('Private Key:', PRIVATE_KEY ? 'Set (hidden)' : 'Missing');
    console.log('User Wallet:', userInfo.walletAddress);
    
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
    
    // Check provider connection
    try {
      const network = await provider.getNetwork();
      console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);
    } catch (networkError) {
      console.error('Error connecting to network:', networkError);
      return bot.sendMessage(
        chatId,
        '❌ Failed to connect to the blockchain network. Please try again later.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }
    
    const botWallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Bot wallet address:', botWallet.address);
    
    // Initialize badge NFT contract with full ABI for better debugging
    const badgeNFT = new ethers.Contract(
      SIMBIBADGE_NFT_CA,
      BADGE_NFT_ABI,
      botWallet
    );
    
    // Verify user is eligible for the specified tier
    try {
      const eligibleTier = await badgeNFT.getEligibleTier(userInfo.walletAddress);
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
      if (error.message && error.message.includes('No eligible tier')) {
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
      
      // Log more detailed error information for debugging
      console.error('Detailed eligibility check error:', {
        message: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
        transaction: error.transaction
      });
      
      // If we can't verify eligibility due to other errors, try to mint anyway
      // The contract should have its own checks in place
      console.log('Proceeding with mint attempt despite eligibility check failure');
    }
    
    // Get current gas price for better transaction handling
    const feeData = await provider.getFeeData();
    console.log('Current gas price data:', {
      gasPrice: feeData.gasPrice?.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    });
    
    // Attempt to mint the NFT
    try {
      // Check if the function exists
      let functionExists = false;
      try {
        const fragment = badgeNFT.interface.getFunction('safeMint');
        functionExists = !!fragment;
        console.log('safeMint function exists:', functionExists);
      } catch (fragError) {
        console.error('Error checking for safeMint function:', fragError);
      }
      
      if (!functionExists) {
        console.log('Attempting to load full contract ABI from file...');
        try {
          // Use fs to read the ABI file contents directly instead of import
          const fullABIPath = path.join(process.cwd(), 'utils', 'SimbiBadgeNFT.json');
          console.log('Attempting to load ABI from:', fullABIPath);
          
          const abiData = await fs.readFile(fullABIPath, 'utf8');
          const fullABI = JSON.parse(abiData);
          console.log('Successfully loaded full ABI:', !!fullABI);
          
          // Create a new contract instance with the full ABI
          const badgeNFTWithFullABI = new ethers.Contract(
            SIMBIBADGE_NFT_CA,
            fullABI,
            botWallet
          );
          
          console.log('Created new contract instance with full ABI');
          
          // Use this new instance for the mint operation
          badgeNFT = badgeNFTWithFullABI;
          console.log('Using full ABI for the minting operation');
          
          // Check again if the function exists now
          const fragment = badgeNFT.interface.getFunction('safeMint');
          functionExists = !!fragment;
          console.log('safeMint function exists with full ABI:', functionExists);
          
          if (!functionExists) {
            throw new Error('The safeMint function does not exist on the contract, even with full ABI');
          }
        } catch (abiError) {
          console.error('Error loading full ABI from file:', abiError);
          
          // Final fallback: try using a minimal ABI with just the safeMint function
          console.log('Attempting final fallback with minimal safeMint ABI...');
          
          const minimalSafeMintABI = [
            "function safeMint(address to, uint8 tier)"
          ];
          
          try {
            const minimalBadgeNFT = new ethers.Contract(
              SIMBIBADGE_NFT_CA,
              minimalSafeMintABI,
              botWallet
            );
            
            console.log('Created contract with minimal safeMint ABI');
            badgeNFT = minimalBadgeNFT;
            functionExists = true;
          } catch (minAbiError) {
            console.error('Error with minimal ABI fallback:', minAbiError);
            throw new Error('The safeMint function does not exist on the contract');
          }
        }
      }
      
      // Prepare gas parameters
      const gasParams = {
        gasLimit: 1000000n, // Increased gas limit for safety
      };
      
      // Add fee data if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        gasParams.maxFeePerGas = feeData.maxFeePerGas;
        gasParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice) {
        gasParams.gasPrice = feeData.gasPrice;
      }
      
      console.log('Mint transaction gas parameters:', gasParams);
      
      // Send the transaction
      const tx = await badgeNFT.safeMint(
        userInfo.walletAddress,
        tier,
        gasParams
      );
      
      console.log('Mint transaction sent:', tx.hash);
      
      // Notify user of pending transaction
      await bot.sendMessage(
        chatId,
        `🔄 *Minting your ${tierName} Tier Badge...*\n\nTransaction is processing on the blockchain.\n\nView on explorer: [${tx.hash.substring(0, 8)}...](https://sepolia.basescan.org/tx/${tx.hash})`,
        { parse_mode: 'Markdown' }
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait(1);
      console.log('Mint transaction confirmed:', receipt.hash);
      
      if (receipt.status === 1) {
        // Try to get the badge URI or image if available
        let badgeImage = null;
        try {
          const tierBaseURI = await badgeNFT.getTierBaseURI(tier);
          console.log('Retrieved badge tier base URI:', tierBaseURI);
          
          // Extract IPFS URI if available
          if (tierBaseURI) {
            badgeImage = tierBaseURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
            console.log('Badge image URL:', badgeImage);
          }
        } catch (uriError) {
          console.error('Error getting badge image URI:', uriError);
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
      
      // Extract the most meaningful error message
      const errorDetails = error.reason || error.data?.message || error.error?.message || error.message || 'Unknown error';
      
      console.error('Detailed minting error:', {
        message: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
        transaction: error.transaction
      });
      
      if (errorDetails.includes('already has badge') || errorDetails.includes('already minted')) {
        errorMessage = `You already own the ${tierName} Tier Badge.`;
      } else if (errorDetails.includes('not eligible')) {
        errorMessage = `You are not eligible for the ${tierName} Tier Badge yet. Keep completing study sessions!`;
      } else if (errorDetails.includes('execution reverted') || errorDetails.includes('transaction failed')) {
        errorMessage += 'The transaction was rejected by the blockchain. This could be due to a contract rule or insufficient gas.';
      } else if (errorDetails.includes('insufficient funds')) {
        errorMessage = '❌ The bot does not have sufficient funds to mint the NFT. Please contact support.';
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