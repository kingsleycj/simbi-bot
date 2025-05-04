const hre = require("hardhat");

async function main() {
  try {
    const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const owner = new hre.ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const SimbiToken = await hre.ethers.getContractFactory("SimbiToken");
    const token = SimbiToken.attach(process.env.SIMBI_CONTRACT_ADDRESS);
    
    console.log('\n=== Token Permissions Check ===');
    console.log('Token Address:', process.env.SIMBI_CONTRACT_ADDRESS);
    console.log('QuizManager Address:', process.env.SIMBIQUIZMANAGER_CA);
    
    // Check if QuizManager is minter
    const isMinter = await token.minters(process.env.SIMBIQUIZMANAGER_CA);
    console.log('QuizManager is minter:', isMinter);
    
    if (!isMinter) {
        console.log('\nGranting minter permissions...');
        const tx = await token.connect(owner).grantMinter(process.env.SIMBIQUIZMANAGER_CA);
        await tx.wait();
        console.log('Minter permissions granted!');
        
        // Verify
        const newIsMinter = await token.minters(process.env.SIMBIQUIZMANAGER_CA);
        console.log('QuizManager is now minter:', newIsMinter);
    }
    
    // Check token supply stats
    const totalSupply = await token.totalSupply();
    const userSupplyCap = await token.USER_SUPPLY_CAP();
    const userMinted = await token.getUserMinted();
    
    console.log('\n=== Token Supply Stats ===');
    console.log('Total Supply:', hre.ethers.formatEther(totalSupply), 'SIMBI');
    console.log('User Supply Cap:', hre.ethers.formatEther(userSupplyCap), 'SIMBI');
    console.log('User Minted:', hre.ethers.formatEther(userMinted), 'SIMBI');
    
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});