import { ethers } from 'ethers';
import { promises as fs } from 'fs';

const registerWallet = async (address) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const quizManager = new ethers.Contract(
      process.env.SIMBIQUIZMANAGER_CA,
      ["function registerWallet(address wallet) external"],
      new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    );

    const tx = await quizManager.registerWallet(address);
    await tx.wait();
    console.log('Wallet registered with contract:', address);
    return true;
  } catch (error) {
    console.error('Failed to register wallet:', error);
    return false;
  }
};

const handleStartCommand = async (bot, users, chatId, USERS_DB_FILE) => {
  try {
    if (users[chatId]) {
      bot.sendMessage(chatId, `👋 Welcome back!
Your wallet address on SIMBI AI-BOT is:

\
\`${users[chatId].address}\`

Use /menu to see available features.`, { parse_mode: 'Markdown' })
        .catch(error => console.error('Error sending welcome back message:', error));
      return;
    }

    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey;
    const address = wallet.address;

    users[chatId] = { address, privateKey, createdAt: new Date().toISOString() };
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2));

    const registered = await registerWallet(address);
    if (!registered) {
      throw new Error('Failed to register wallet with contract');
    }

    bot.sendMessage(chatId, `🎉 *Your Wallet ON SIMBI AI-BOT has been created!*

*Address:* \
\`${address}\`
*Private Key:* \
\`${privateKey}\`

⚡ Save your private key safely!

Use /menu to explore all features.`, { parse_mode: 'Markdown' })
      .catch(error => console.error('Error sending wallet info:', error));
  } catch (error) {
    console.error('Error in handleStartCommand:', error);
    bot.sendMessage(chatId, '❌ Failed to create wallet. Please try again.');
  }
};

export { handleStartCommand };