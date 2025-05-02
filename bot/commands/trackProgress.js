// Description: This module handles the /trackProgress command and fetches on-chain progress and achievement NFTs for a user.
// It uses the ethers.js library to interact with Ethereum smart contracts and fetch user data.
require('dotenv').config();
const { ethers, JsonRpcProvider } = require('ethers');

console.log('Environment Variables Debug:');
console.log('BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL);
console.log('SIMBIBADGE_NFT_CA:', process.env.SIMBIBADGE_NFT_CA);

const handleTrackProgressCommand = (bot, users, chatId) => {
  const SIMBI_CONTRACT_ADDRESS = process.env.SIMBI_CONTRACT_ADDRESS;
  const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
  const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

  const userAddress = users[chatId]?.address;

  if (!userAddress) {
    bot.sendMessage(chatId, '❗ You have no wallet yet. Use /start to create one.');
    return;
  }

  if (!SIMBIBADGE_NFT_CA) {
    console.error('SIMBIBADGE_NFT_CA is not defined or invalid.');
    bot.sendMessage(chatId, '⚠️ Configuration error: NFT contract address is missing. Please contact support.');
    return;
  }

  console.log('Using SIMBIBADGE_NFT_CA:', SIMBIBADGE_NFT_CA);

  const provider = new JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const simbiToken = new ethers.Contract(
    SIMBI_CONTRACT_ADDRESS,
    ["function balanceOf(address account) view returns (uint256)"],
    provider
  );

  const simbiBadgeNFT = new ethers.Contract(
    SIMBIBADGE_NFT_CA,
    ["function balanceOf(address owner) view returns (uint256)"],
    provider
  );

  Promise.all([
    simbiToken.balanceOf(userAddress),
    simbiBadgeNFT.balanceOf(userAddress)
  ])
    .then(([tokenBalance, nftCount]) => {
      console.log('Token Balance Raw:', tokenBalance);
      console.log('NFT Count Raw:', nftCount);

      if (tokenBalance === undefined || tokenBalance === null) {
        throw new Error('Token balance is undefined or null');
      }

      bot.sendMessage(chatId, `📊 *On-Chain Progress*\n\n👛 *SIMBI Token Balance:* ${ethers.utils.formatEther(tokenBalance)} SIMBI\n🏅 *NFT Achievements:* ${nftCount} NFTs`, { parse_mode: 'Markdown' });
    })
    .catch((error) => {
      console.error('Error fetching on-chain progress:', error);
      bot.sendMessage(chatId, '⚠️ Failed to fetch on-chain progress. Please try again later.');
    });
};

const handleAchievementNFTs = (bot, users, chatId) => {
  const SIMBIBADGE_NFT_CA = process.env.SIMBIBADGE_NFT_CA;
  const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;

  const userAddress = users[chatId]?.address;

  if (!userAddress) {
    bot.sendMessage(chatId, '❗ You have no wallet yet. Use /start to create one.');
    return;
  }

  if (!SIMBIBADGE_NFT_CA) {
    console.error('SIMBIBADGE_NFT_CA is not defined or invalid.');
    bot.sendMessage(chatId, '⚠️ Configuration error: NFT contract address is missing. Please contact support.');
    return;
  }

  console.log('Using SIMBIBADGE_NFT_CA:', SIMBIBADGE_NFT_CA);

  const provider = new JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
  const simbiBadgeNFT = new ethers.Contract(
    SIMBIBADGE_NFT_CA,
    ["function getAttemptCounts(address user) view returns (uint256, uint256, uint256)"],
    provider
  );

  simbiBadgeNFT.getAttemptCounts(userAddress)
    .then(([bronze, silver, gold]) => {
      bot.sendMessage(chatId, `🏅 *Your Achievement NFTs:*\n\n🥉 *Bronze Attempts:* ${bronze}\n🥈 *Silver Attempts:* ${silver}\n🥇 *Gold Attempts:* ${gold}`, { parse_mode: 'Markdown' });
    })
    .catch((error) => {
      console.error('Error fetching achievement NFTs:', error);
      bot.sendMessage(chatId, '⚠️ Failed to fetch achievement NFTs. Please try again later.');
    });
};

module.exports = { handleTrackProgressCommand, handleAchievementNFTs };