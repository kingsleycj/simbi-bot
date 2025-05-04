import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function verifyContractSetup() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const botWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('\n=== Contract Verification ===');
    
    // Check QuizManager
    const quizManager = new ethers.Contract(
        process.env.SIMBIQUIZMANAGER_CA,
        ["function owner() view returns (address)", "function token() view returns (address)"],
        provider
    );

    const owner = await quizManager.owner();
    const tokenAddress = await quizManager.token();

    console.log('QuizManager Contract:', process.env.SIMBIQUIZMANAGER_CA);
    console.log('Owner:', owner);
    console.log('Is bot owner?', owner.toLowerCase() === botWallet.address.toLowerCase());
    console.log('Token address:', tokenAddress);

    // Check Token
    const token = new ethers.Contract(
        tokenAddress,
        ["function minters(address) view returns (bool)"],
        provider
    );

    const canMint = await token.minters(process.env.SIMBIQUIZMANAGER_CA);
    console.log('QuizManager can mint tokens:', canMint);

    // Add these checks
    const userBalance = await provider.getBalance(botWallet.address);
    console.log('\n=== Wallet Status ===');
    console.log('Bot ETH Balance:', ethers.formatEther(userBalance));

    // Add contract state checks
    const quizManagerCode = await provider.getCode(process.env.SIMBIQUIZMANAGER_CA);
    const tokenCode = await provider.getCode(tokenAddress);

    console.log('\n=== Contract Status ===');
    console.log('QuizManager has code:', quizManagerCode !== '0x');
    console.log('Token has code:', tokenCode !== '0x');

    // Add more detailed token checks
    const fullToken = new ethers.Contract(
        tokenAddress,
        [
            "function balanceOf(address) view returns (uint256)",
            "function totalSupply() view returns (uint256)",
            "function USER_SUPPLY_CAP() view returns (uint256)"
        ],
        provider
    );

    const tokenSupply = await fullToken.totalSupply();
    const userSupplyCap = await fullToken.USER_SUPPLY_CAP();
    console.log('\n=== Token Stats ===');
    console.log('Total Supply:', ethers.formatEther(tokenSupply));
    console.log('User Supply Cap:', ethers.formatEther(userSupplyCap));
}

verifyContractSetup().catch(console.error);