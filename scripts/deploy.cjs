const { ethers } = require("hardhat");

async function main() {
    try {
        // Initialize ethers
        await hre.run('compile');
        
        // Get network
        const provider = ethers.provider;
        const network = await provider.getNetwork();
        console.log("Deploying to network:", network.name);

        // Get signer
        const [deployer] = await ethers.getSigners();
        if (!deployer) throw new Error("No signer available");
        
        console.log("Deploying contracts with account:", deployer.address);
        
        // Get and log balance
        const balance = await provider.getBalance(deployer.address);
        console.log("Account balance:", ethers.formatEther(balance), "ETH");

        // Token image URI
        const tokenImageURI = "ipfs://bafybeiagahmsxgp5wwx5vstgygt6bwbmvtwmkuaup3pevf55nnewj4ui2e";

        // Deploy SimbiToken
        console.log("\nDeploying SimbiToken...");
        const SimbiToken = await ethers.getContractFactory("SimbiToken");
        const simbiToken = await SimbiToken.deploy(tokenImageURI);
        await simbiToken.waitForDeployment();
        const simbiTokenAddress = await simbiToken.getAddress();
        console.log(`✅ SimbiToken deployed to: ${simbiTokenAddress}`);

        // Deploy SimbiBadgeNFT
        console.log("\nDeploying SimbiBadgeNFT...");
        const SimbiBadgeNFT = await ethers.getContractFactory("SimbiBadgeNFT");
        const simbiBadgeNFT = await SimbiBadgeNFT.deploy();
        await simbiBadgeNFT.waitForDeployment();
        const simbiBadgeNFTAddress = await simbiBadgeNFT.getAddress();
        console.log(`✅ SimbiBadgeNFT deployed to: ${simbiBadgeNFTAddress}`);

        // Deploy SimbiCredentialNFT
        console.log("\nDeploying SimbiCredentialNFT...");
        const SimbiCredentialNFT = await ethers.getContractFactory("SimbiCredentialNFT");
        const simbiCredentialNFT = await SimbiCredentialNFT.deploy();
        await simbiCredentialNFT.waitForDeployment();
        const simbiCredentialNFTAddress = await simbiCredentialNFT.getAddress();
        console.log(`✅ SimbiCredentialNFT deployed to: ${simbiCredentialNFTAddress}`);

        // Deploy SimbiQuizManager
        console.log("\nDeploying SimbiQuizManager...");
        const SimbiQuizManager = await ethers.getContractFactory("SimbiQuizManager");
        const quizManager = await SimbiQuizManager.deploy(
            simbiTokenAddress,
            simbiBadgeNFTAddress,
            simbiCredentialNFTAddress
        );
        await quizManager.waitForDeployment();
        const quizManagerAddress = await quizManager.getAddress();
        console.log(`✅ SimbiQuizManager deployed to: ${quizManagerAddress}`);

        // Wait for confirmations
        console.log("\nWaiting for confirmations...");
        await Promise.all([
            simbiToken.deploymentTransaction().wait(5),
            simbiBadgeNFT.deploymentTransaction().wait(5),
            simbiCredentialNFT.deploymentTransaction().wait(5),
            quizManager.deploymentTransaction().wait(5)
        ]);

        // Verify contracts
        console.log("\nVerifying contracts...");
        
        await hre.run("verify:verify", {
            address: simbiTokenAddress,
            constructorArguments: [tokenImageURI],
        });

        await hre.run("verify:verify", {
            address: simbiBadgeNFTAddress,
            constructorArguments: [],
        });

        await hre.run("verify:verify", {
            address: simbiCredentialNFTAddress,
            constructorArguments: [],
        });

        await hre.run("verify:verify", {
            address: quizManagerAddress,
            constructorArguments: [
                simbiTokenAddress,
                simbiBadgeNFTAddress,
                simbiCredentialNFTAddress
            ],
        });

        // Print deployment summary
        console.log("\nDeployment Summary:");
        console.log("===================");
        console.log(`Network: ${network.name}`);
        console.log(`SimbiToken: ${simbiTokenAddress}`);
        console.log(`SimbiBadgeNFT: ${simbiBadgeNFTAddress}`);
        console.log(`SimbiCredentialNFT: ${simbiCredentialNFTAddress}`);
        console.log(`SimbiQuizManager: ${quizManagerAddress}`);

    } catch (error) {
        console.error("\nDeployment failed:", error);
        process.exit(1);
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });