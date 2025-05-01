const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Token image URI
    const tokenImageURI = "ipfs://bafybeiagahmsxgp5wwx5vstgygt6bwbmvtwmkuaup3pevf55nnewj4ui2e";

    // Deploy SimbiToken first
    console.log("Deploying SimbiToken...");
    const SimbiToken = await hre.ethers.getContractFactory("SimbiToken");
    const simbiToken = await SimbiToken.deploy(tokenImageURI);
    await simbiToken.deployed();
    console.log(`✅ SimbiToken deployed to: ${simbiToken.address}`);
    console.log(`Token Image URI: ${tokenImageURI}`);

    // Deploy SimbiBadgeNFT
    console.log("Deploying SimbiBadgeNFT...");
    const SimbiBadgeNFT = await hre.ethers.getContractFactory("SimbiBadgeNFT");
    const simbiBadgeNFT = await SimbiBadgeNFT.deploy();
    await simbiBadgeNFT.deployed();
    console.log(`✅ SimbiBadgeNFT deployed to: ${simbiBadgeNFT.address}`);

    // Deploy SimbiCredentialNFT
    console.log("Deploying SimbiCredentialNFT...");
    const SimbiCredentialNFT = await hre.ethers.getContractFactory("SimbiCredentialNFT");
    const simbiCredentialNFT = await SimbiCredentialNFT.deploy();
    await simbiCredentialNFT.deployed();
    console.log(`✅ SimbiCredentialNFT deployed to: ${simbiCredentialNFT.address}`);

    // Deploy SimbiQuizManager last (as it might interact with other contracts)
    console.log("Deploying SimbiQuizManager...");
    const SimbiQuizManager = await hre.ethers.getContractFactory("SimbiQuizManager");
    const simbiQuizManager = await SimbiQuizManager.deploy(
        simbiToken.address,
        simbiBadgeNFT.address,
        simbiCredentialNFT.address
    );
    await simbiQuizManager.deployed();
    console.log(`✅ SimbiQuizManager deployed to: ${simbiQuizManager.address}`);

    // Verify contracts on BaseScan
    console.log("\nWaiting for 5 block confirmations before verification...");
    await simbiToken.deployTransaction.wait(5);
    await simbiBadgeNFT.deployTransaction.wait(5);
    await simbiCredentialNFT.deployTransaction.wait(5);
    await simbiQuizManager.deployTransaction.wait(5);

    console.log("\nVerifying contracts on BaseScan...");
    try {
        await hre.run("verify:verify", {
            address: simbiToken.address,
            constructorArguments: [tokenImageURI],
        });
        console.log("✅ SimbiToken verified");

        await hre.run("verify:verify", {
            address: simbiBadgeNFT.address,
            constructorArguments: [],
        });
        console.log("✅ SimbiBadgeNFT verified");

        await hre.run("verify:verify", {
            address: simbiCredentialNFT.address,
            constructorArguments: [],
        });
        console.log("✅ SimbiCredentialNFT verified");

        await hre.run("verify:verify", {
            address: simbiQuizManager.address,
            constructorArguments: [
                simbiToken.address,
                simbiBadgeNFT.address,
                simbiCredentialNFT.address
            ],
        });
        console.log("✅ SimbiQuizManager verified");
    } catch (error) {
        console.error("Verification failed:", error);
    }

    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log(`SimbiToken: ${simbiToken.address}`);
    console.log(`Token Image URI: ${tokenImageURI}`);
    console.log(`SimbiBadgeNFT: ${simbiBadgeNFT.address}`);
    console.log(`SimbiCredentialNFT: ${simbiCredentialNFT.address}`);
    console.log(`SimbiQuizManager: ${simbiQuizManager.address}`);
    
    // Log token distribution information
    const creatorSupply = await simbiToken.balanceOf(deployer.address);
    const userSupplyCap = await simbiToken.getRemainingUserSupply();
    console.log("\nToken Distribution:");
    console.log("===================");
    console.log(`Creator's Share (40%): ${creatorSupply.toString()} SIMBI`);
    console.log(`Available for Users (60%): ${userSupplyCap.toString()} SIMBI`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });