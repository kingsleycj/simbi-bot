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
    
    // Check token supply stats
    const totalSupply = await token.totalSupply();
    const userSupplyCap = await token.USER_SUPPLY_CAP();
    
    console.log('\n=== Token Supply Stats ===');
    console.log('Total Supply:', hre.ethers.formatEther(totalSupply), 'SIMBI');
    console.log('User Supply Cap:', hre.ethers.formatEther(userSupplyCap), 'SIMBI');
    
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });