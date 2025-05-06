import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

// Token ABI for detailed token information
const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// Load users data
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    
    // Handle empty file case
    if (!data.trim()) {
      return {};
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

const handleWalletInfo = async (bot, chatId) => {
  try {
    // Load users to get the wallet address
    const users = await loadUsers();
    const userInfo = users[chatId.toString()];

    // Check if user has a wallet
    if (!userInfo || !userInfo.address) {
      return bot.sendMessage(
        chatId,
        "⚠️ You don't have a wallet yet. Use /start to create one.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    const walletAddress = userInfo.address;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const SIMBI_CONTRACT_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;

    if (!BASE_SEPOLIA_RPC_URL || !SIMBI_CONTRACT_ADDRESS) {
      return bot.sendMessage(
        chatId,
        "⚠️ Configuration error. Please contact support.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Send initial message while fetching data
    await bot.sendMessage(chatId, '🔍 *Fetching your wallet information...*', { parse_mode: 'Markdown' });

    // Initialize provider and contract
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    const simbiToken = new ethers.Contract(
      SIMBI_CONTRACT_ADDRESS,
      TOKEN_ABI,
      provider
    );

    // Fetch token information
    const [tokenBalance, decimals, symbol, name] = await Promise.all([
      simbiToken.balanceOf(walletAddress),
      simbiToken.decimals(),
      simbiToken.symbol(),
      simbiToken.name()
    ]);

    // Get account balance
    const nativeBalance = await provider.getBalance(walletAddress);
    const formattedNativeBalance = ethers.formatEther(nativeBalance);
    const formattedTokenBalance = ethers.formatUnits(tokenBalance, decimals);

    // Blockchain explorer link
    const explorerUrl = `https://sepolia.basescan.org/address/${walletAddress}`;

    // Generate wallet information
    const walletInfo = `
👛 *Wallet Information*

*Address:* \`${walletAddress}\`

*Balances:*
• ${formattedTokenBalance} ${symbol} (${name})
• ${formattedNativeBalance} BASE (Base Sepolia)

*Transactions:*
• View on [Block Explorer](${explorerUrl})

*Tips:*
• Earn more ${symbol} by completing quizzes and study sessions
• Tokens can be used for premium features and rewards in future updates
`;

    await bot.sendMessage(
      chatId,
      walletInfo,
      {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 View Progress", callback_data: "progress" },
              { text: "👤 View Profile", callback_data: "profile" }
            ],
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error handling wallet info:', error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while fetching your wallet information. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

export { handleWalletInfo };