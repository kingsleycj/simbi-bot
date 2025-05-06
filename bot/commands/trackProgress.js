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
  "function quizScores(address) view returns (uint256)"
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
    const SIMBI_CONTRACT_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const SIMBIQUIZMANAGER_CA = process.env.SIMBIQUIZMANAGER_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    const userAddress = users[chatId]?.address;

    if (!userAddress) {
      return bot.sendMessage(
        chatId, 
        '❗ You have no wallet yet. Use /start to create one.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
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

    // Fetch all data in parallel for efficiency
    const [
      tokenBalance, 
      decimals,
      symbol,
      [bronze, silver, gold],
      completedQuizzes,
      quizScores,
      nftCount
    ] = await Promise.all([
      simbiToken.balanceOf(userAddress),
      simbiToken.decimals(),
      simbiToken.symbol(),
      simbiBadgeNFT.getAttemptCounts(userAddress),
      quizManager.completedQuizzes(userAddress),
      quizManager.quizScores(userAddress),
      simbiBadgeNFT.balanceOf(userAddress)
    ]);

    // Calculate formatted token balance
    const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
    
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
• Total Badges: ${nftCount.toString()}
• Bronze Tier Progress: ${bronze.toString()}/20
• Silver Tier Progress: ${silver.toString()}/50
• Gold Tier Progress: ${gold.toString()}/70

🔗 *Cross-Platform Access:*
• View on blockchain explorer: ${explorerUrl}
• Scan the QR code to view on mobile
• Use command /export_progress to receive a full report by email
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
    const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

    const userAddress = users[chatId]?.address;

    if (!userAddress) {
      return bot.sendMessage(
        chatId, 
        '❗ You have no wallet yet. Use /start to create one.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
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

    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    const simbiBadgeNFT = new ethers.Contract(
      SIMBIBADGE_NFT_CA,
      BADGE_NFT_ABI,
      provider
    );

    // Get attempt counts and balance
    const [attemptCounts, nftBalance] = await Promise.all([
      simbiBadgeNFT.getAttemptCounts(userAddress),
      simbiBadgeNFT.balanceOf(userAddress)
    ]);

    const [bronze, silver, gold] = attemptCounts;
    
    // Generate NFT achievement message
    let nftMessage = `🏅 *Your Achievement NFTs*\n\n`;
    
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
    nftMessage += `🎖️ *Total NFT Badges:* ${nftBalance}\n\n`;
    nftMessage += `🔍 Complete more study sessions and quizzes to earn more badges!`;

    // Send achievements with Back to Menu button
    await bot.sendMessage(
      chatId, 
      nftMessage, 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 View Full Progress", callback_data: "progress" },
              { text: "🔙 Back to Menu", callback_data: "menu" }
            ]
          ]
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
    const userAddress = users[chatId]?.address;
    
    if (!userAddress) {
      return bot.sendMessage(
        chatId, 
        '❗ You need a wallet to share progress. Use /start to create one.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
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
• Copy the link to view in any browser
• Connect your wallet to the SIMBI web app
• Import your wallet in any Web3 wallet app

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

export { handleTrackProgressCommand, handleAchievementNFTs, handleShareProgress };