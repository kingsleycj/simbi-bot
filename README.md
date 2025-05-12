# SIMBI Web3 Telegram Bot

## Overview
The SIMBI Web3 Telegram Bot is a decentralized study companion that integrates blockchain technology to reward users for learning with an AI Chat with SIMBI. Built with Node.js and Ethereum (Base Sepolia), it offers quiz-based learning with token rewards and NFT achievements, amongst other features.

## Features

### 1. **Wallet Management**
- **/start**: Automatically generates a new Ethereum wallet for users.
- **registration**: the generated wallet is automatically registered to the smart contract after generation and it enables the reward features to work.

### 2. **Quiz Functionality**
- **/quiz**: Users can select a quiz category (e.g., history, science, maths, government) and answer questions.
  - Correct answers reward users with SIMBI tokens.
  - Categories are dynamically loaded from `quizQuestions.json`.

### 3. **Study Reminders**
- **/reminder**: Users can set study reminders at specific times.
  - Reminders are scheduled using the `node-schedule` library.

### 4. **On-Chain Progress Tracking**
- **/track_progress**: Displays the user's SIMBI token balance and NFT achievements.
  - Fetches data from the blockchain using the `ethers` library.

### 5. **Profile Management**
- **/sync**: Syncs the user's Telegram account with their web app account.
- **/menu**: Provides a user-friendly menu to access all features.

### 6. **Achievement NFTs**
- Users earn NFTs for completing quizzes and achieving milestones.
- NFTs are minted using the `SimbiBadgeNFT` and `SimbiCredentialNFT` smart contracts.

### 7. **Personality-Driven Interactions**
- The bot provides motivational messages and humor to keep users engaged.
- Accessible via the "Motivation" and "Humor" buttons in the menu.
- Groq API Integration for SIMBI's personalized responses based on the user's context.

### 8. **Study-to-Earn Functionality**
- Users can create and join study groups.
- Stake SIMBI tokens in study groups for accountability and rewards.

### 9. **Chat With SIMBI**
- Users can chat with SIMBI to aid with their studies and planning.

## Technologies Used

### Backend
- **Node.js**: Core runtime for the bot.
- **Express.js**: Handles webhook integration with Telegram.
- **node-telegram-bot-api**: Telegram Bot API wrapper.
- **node-schedule**: Schedules reminders.
- **groq-sdk**: Groq AI API Integration 

### Blockchain
- **Ethers.js**: Interacts with Ethereum smart contracts.
- **Hardhat**: Development environment for smart contracts.
- **Smart Contracts**:
  - `SimbiToken.sol`: ERC20 token for rewards.
  - `SimbiBadgeNFT.sol`: ERC721 NFT for achievements.
  - `SimbiCredentialNFT.sol`: Soulbound NFT for credentials.
  - `SimbiQuizManager.sol`: Manages quiz rewards and NFT minting.

### Data Storage
- **JSON Files**: Stores user data and quiz questions.

## Project Structure
```
├── bot/
│   ├── commands/
│   │   ├── chat.js
│   │   ├── study_session.js
│   │   ├── help.js
│   │   ├── profile.js
│   │   ├── wallet.js
│   │   ├── connect.js
│   │   ├── menu.js
│   │   ├── quiz.js
│   │   ├── reminder.js
│   │   ├── start.js
│   │   ├── sync.js
│   │   └── trackProgress.js
├── contracts/
│   ├── SimbiBadgeNFT.sol
│   ├── SimbiCredentialNFT.sol
│   ├── SimbiQuizManager.sol
│   └── SimbiToken.sol
├── utils/
│   ├── quizQuestions.json
│   ├── SimbiBadgeNFT.json
│   ├── SimbiCredentialNFT.json
│   ├── SimbiQuizManager.json
│   └── SimbiToken.json
├── index.js
├── package.json
├── README.md
└── users.json
```

## Testing Guide

### Prerequisites
1. Install Node.js and npm.
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables in a `.env` file:
   ```env
   BOT_TOKEN=<Your Telegram Bot Token>
   WEBHOOK_URL=<Your Webhook URL>
   PORT=3000
   PRIVATE_KEY=<Your Ethereum Private Key>
   BASE_SEPOLIA_RPC_URL=<Your Ethereum RPC URL>
   SIMBI_CONTRACT_ADDRESS=<SimbiToken Contract Address>
   SIMBIBADGE_NFT_CA=<SimbiBadgeNFT Contract Address>
   SIMBI_CREDENTIAL_NFT=<SimbiCredentialNFT Contract Address>
   SIMBIQUIZMANAGER_CA=<SimbiQuizManager Contract Address>
   ENCRYPTION_KEY=<Your 32-character encryption key>
   SIMBI_GROQ_API=<Your Groq API key>
   ```

### Running the Bot
1. Start the bot:
```bash
npm start
   ```
2. Interact with the bot on Telegram using the commands listed above.

### Testing Features
- **Wallet Management**:
  - Use `/start` to create a wallet.
  - Use `/connect` to link a custom wallet.
- **Quiz Functionality**:
  - Use `/quiz` to take quizzes and earn rewards.
- **Reminders**:
  - Use `/reminder` to set study reminders.
- **Progress Tracking**:
  - Use `/track_progress` to view on-chain progress.
- **Menu Navigation**:
  - Use `/menu` to access all features.

## Contributing
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes and push to your branch.
4. Submit a pull request.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments
- OpenZeppelin for secure smart contract libraries.
- Telegram for the Bot API.
- Hardhat for the smart contract development environment.

## Environment Variables

Make sure to set the following environment variables in your `.env` file:

```
# Bot Configuration
BOT_TOKEN=<Your Telegram Bot Token>
WEBHOOK_URL=<Your Webhook URL>
PORT=3000

# Blockchain Configuration
BASE_SEPOLIA_RPC_URL=<Your Ethereum RPC URL>
PRIVATE_KEY=<Your Ethereum Private Key>

# Contract Addresses
SIMBIQUIZMANAGER_CA=<SimbiQuizManager Contract Address>
SIMBI_CONTRACT_ADDRESS=<SimbiToken Contract Address>
SIMBIBADGE_NFT_CA=<SimbiBadgeNFT Contract Address>
SIMBI_CREDENTIAL_NFT=<SimbiCredentialNFT Contract Address>

# Security Configuration
ENCRYPTION_KEY=<Your 32-character encryption key>

# AI Integration 
SIMBI_GROQ_API=<Your Groq API key>
```

## Security Features

### Private Key Encryption

User wallet private keys are encrypted before being stored in the database using AES-256 encryption. The encryption key is specified via the `ENCRYPTION_KEY` environment variable.

For existing deployments, run the migration script to encrypt any plain text private keys:

```
node scripts/migrateToEncryption.js
```

## Installation

1. Clone the repository
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Run the bot with `npm start`

## Commands

- `/start` - Create a new wallet and get started
- `/menu` - Show main menu
- `/wallet` - View wallet information
- `/profile` - View user profile
- `/quiz` - Start a quiz to earn tokens
- `/study_session` - Start a study session to track progress
- `/help` - Show help information

## Contributors
- Kingsley Nweke