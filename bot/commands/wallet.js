import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getUser } from '../db-adapter.js';

dotenv.config();

// Token ABI for detailed token information
const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

const handleWalletInfo = async (bot, chatId, msg = null) => {
  try {
    // Load user data from database using adapter
    const userInfo = await getUser(chatId.toString());
    
    // Check if user has a wallet
    if (!userInfo || !userInfo.walletAddress) {
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

    const walletAddress = userInfo.walletAddress;
    const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const SIMBI_TOKEN_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;
    
    if (!BASE_SEPOLIA_RPC_URL) {
      return bot.sendMessage(
        chatId,
        "⚠️ Blockchain connection not available. Please try again later.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Connect to Base Sepolia network
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    
    // Get ETH balance
    const ethBalance = await provider.getBalance(walletAddress);
    const formattedEthBalance = ethers.formatEther(ethBalance);
    
    // Initialize wallet info message
    let walletInfo = `
👛 *Wallet Information*

• Address: \`${walletAddress}\`
• Base ETH Balance: ${formattedEthBalance} ETH
`;

    // Check if SIMBI token exists
    let tokenBalanceInfo = "";
    if (SIMBI_TOKEN_ADDRESS) {
      try {
        const tokenContract = new ethers.Contract(
          SIMBI_TOKEN_ADDRESS,
          TOKEN_ABI,
          provider
        );
        
        // Get token details
        const [rawBalance, decimals, symbol, name] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals(),
          tokenContract.symbol(),
          tokenContract.name()
        ]);
        
        // Format token balance
        const tokenBalance = Number(ethers.formatUnits(rawBalance, decimals));
        
        // Add token information to wallet info
        tokenBalanceInfo = `
• ${name} (${symbol}): ${tokenBalance} ${symbol}`;

      } catch (tokenError) {
        console.error('Error fetching token data:', tokenError);
        tokenBalanceInfo = `
• SIMBI Token: Error fetching balance`;
      }
    }
    
    // Add token balance info to main message
    walletInfo += tokenBalanceInfo;
    
    // Add block explorer link
    const explorerUrl = "https://sepolia.basescan.org/address/" + walletAddress;
    walletInfo += `

🔍 [View on Block Explorer](${explorerUrl})

💡 *Return to your profile to see more details or back to menu.*
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
              { text: "👤 Back to Profile", callback_data: "profile" },
              { text: "🔙 Back to Menu", callback_data: "menu" }
            ]
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