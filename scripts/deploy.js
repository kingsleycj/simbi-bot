import { ethers } from 'hardhat';
import hre from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Token image URI
    const tokenImageURI = "ipfs://bafybeiagahmsxgp5wwx5vstgygt6bwbmvtwmkuaup3pevf55nnewj4ui2e";

    // Deploy SimbiToken
    console.log("Deploying SimbiToken...");
    const SimbiToken = await hre.ethers.getContractFactory("SimbiToken");
    const simbiTokenTx = await SimbiToken.deploy(tokenImageURI);
    const simbiTokenReceipt = await simbiTokenTx.deploymentTransaction().wait();
    const simbiTokenAddress = simbiTokenReceipt.contractAddress;
    console.log(`✅ SimbiToken deployed to: ${simbiTokenAddress}`);
    console.log(`Token Image URI: ${tokenImageURI}`);

    // Log token distribution information
    const creatorSupply = await simbiTokenTx.balanceOf(deployer.address);
    const userSupplyCap = await simbiTokenTx.getRemainingUserSupply();
    console.log("\nToken Distribution:");
    console.log("===================");
    console.log(`Creator's Share (40%): ${creatorSupply.toString()} SIMBI`);
    console.log(`Available for Users (60%): ${userSupplyCap.toString()} SIMBI`);

    // Deploy SimbiBadgeNFT
    console.log("Deploying SimbiBadgeNFT...");
    const SimbiBadgeNFT = await hre.ethers.getContractFactory("SimbiBadgeNFT");
    const simbiBadgeNFTTx = await SimbiBadgeNFT.deploy();
    const simbiBadgeNFTReceipt = await simbiBadgeNFTTx.deploymentTransaction().wait();
    const simbiBadgeNFTAddress = simbiBadgeNFTReceipt.contractAddress;
    console.log(`✅ SimbiBadgeNFT deployed to: ${simbiBadgeNFTAddress}`);

    // Deploy SimbiCredentialNFT
    console.log("Deploying SimbiCredentialNFT...");
    const SimbiCredentialNFT = await hre.ethers.getContractFactory("SimbiCredentialNFT");
    const simbiCredentialNFTTx = await SimbiCredentialNFT.deploy();
    const simbiCredentialNFTReceipt = await simbiCredentialNFTTx.deploymentTransaction().wait();
    const simbiCredentialNFTAddress = simbiCredentialNFTReceipt.contractAddress;
    console.log(`✅ SimbiCredentialNFT deployed to: ${simbiCredentialNFTAddress}`);

    // Deploy SimbiQuizManager
    console.log("Deploying SimbiQuizManager...");
    const SimbiQuizManager = await hre.ethers.getContractFactory("SimbiQuizManager");
    const simbiQuizManagerTx = await SimbiQuizManager.deploy(
        simbiTokenAddress,
        simbiBadgeNFTAddress,
        simbiCredentialNFTAddress
    );
    const simbiQuizManagerReceipt = await simbiQuizManagerTx.deploymentTransaction().wait();
    const simbiQuizManagerAddress = simbiQuizManagerReceipt.contractAddress;
    console.log(`✅ SimbiQuizManager deployed to: ${simbiQuizManagerAddress}`);

    console.log("\nVerifying contracts on BaseScan...");
    try {
        await hre.run("verify:verify", {
            address: simbiTokenAddress,
            constructorArguments: [tokenImageURI],
        });
        console.log("✅ SimbiToken verified");

        await hre.run("verify:verify", {
            address: simbiBadgeNFTAddress,
            constructorArguments: [],
        });
        console.log("✅ SimbiBadgeNFT verified");

        await hre.run("verify:verify", {
            address: simbiCredentialNFTAddress,
            constructorArguments: [],
        });
        console.log("✅ SimbiCredentialNFT verified");

        await hre.run("verify:verify", {
            address: simbiQuizManagerAddress,
            constructorArguments: [
                simbiTokenAddress,
                simbiBadgeNFTAddress,
                simbiCredentialNFTAddress
            ],
        });
        console.log("✅ SimbiQuizManager verified");
    } catch (error) {
        console.error("Verification failed:", error);
    }

    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log(`SimbiToken: ${simbiTokenAddress}`);
    console.log(`Token Image URI: ${tokenImageURI}`);
    console.log(`SimbiBadgeNFT: ${simbiBadgeNFTAddress}`);
    console.log(`SimbiCredentialNFT: ${simbiCredentialNFTAddress}`);
    console.log(`SimbiQuizManager: ${simbiQuizManagerAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });