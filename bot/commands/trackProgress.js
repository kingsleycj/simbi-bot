const { ethers } = require('ethers');

const handleTrackProgressCommand = (bot, users, chatId, SIMBI_CONTRACT_ADDRESS, SIMBIBADGE_NFT_CA, BASE_SEPOLIA_RPC_URL) => {
  const userAddress = users[chatId]?.address;

  if (!userAddress) {
    bot.sendMessage(chatId, '❗ You have no wallet yet. Use /start to create one.');
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
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
      bot.sendMessage(chatId, `📊 *On-Chain Progress*

👛 *SIMBI Token Balance:* ${ethers.utils.formatEther(tokenBalance)} SIMBI
🏅 *NFT Achievements:* ${nftCount} NFTs`, { parse_mode: 'Markdown' });
    })
    .catch((error) => {
      console.error('Error fetching on-chain progress:', error);
      bot.sendMessage(chatId, '⚠️ Failed to fetch on-chain progress. Please try again later.');
    });
};

module.exports = { handleTrackProgressCommand };