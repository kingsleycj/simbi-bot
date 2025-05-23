# SIMBI Web3 Telegram Bot

<div align="center">
  <img src="https://img.shields.io/badge/platform-telegram-blue" alt="Platform">
  <img src="https://img.shields.io/badge/blockchain-Base Sepolia-blue" alt="Blockchain">
  <img src="https://img.shields.io/badge/language-JavaScript-yellow" alt="Language">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</div>

## Overview

SIMBI is a decentralized AI study companion that integrates blockchain technology to reward users for learning. Built with Node.js and deployed on Base Sepolia (Ethereum L2), it creates an engaging learn-to-earn environment through quizzes, study sessions, and AI-powered assistance.

## Key Features

### User Authentication & Wallet Management

- **Automatic Wallet Generation**: Secure wallet creation for new users via `/start` command
- **Custom Wallet Connection**: Connect existing wallets via `/connect` command
- **Encrypted Private Keys**: AES-256 encryption for all wallet private keys
- **Smart Contract Registration**: Automatic wallet registration with blockchain contracts

### Quiz System

- **Multi-category Quizzes**: Test knowledge across history, science, mathematics, and government
- **Token Rewards**: Earn SIMBI tokens for correct answers, with on-chain verification
- **Difficulty Progression**: Increasingly challenging questions with higher rewards
- **NFT Achievements**: Earn badge NFTs based on quiz performance and milestones

### Study Session Tracking

- **Pomodoro Technique**: Structured study sessions (25 or 50 minutes) with rewards
- **Blockchain Rewards**: Earn SIMBI tokens for completed study sessions
- **Session History**: Track completed sessions and earned rewards
- **Achievement System**: Special NFT badges for study session milestones

### Progress Tracking

- **On-chain Data Display**: View token balances, NFT achievements, and quiz performance
- **QR Code Generation**: Shareable QR codes for cross-platform access to blockchain data
- **Achievement Showcase**: Visual representation of earned badges and credentials
- **Detailed Statistics**: Performance metrics across quizzes and study sessions

### AI-powered Assistance

- **Chat with SIMBI**: AI companion for learning assistance via Groq API integration
- **Personalized Support**: Context-aware responses based on user learning history
- **Study Planning**: Assistance with setting learning goals and study schedules
- **Motivational Support**: Customized motivational messages to encourage persistence

### User Experience

- **Intuitive Menu System**: Easy navigation through inline buttons
- **Back to Menu Navigation**: Consistent return option on all screens
- **Profile Management**: View and update user information
- **Cross-platform Access**: Support for mobile and desktop Telegram clients

### Security Features

- **Private Key Encryption**: AES-256 encryption for all stored private keys
- **Environment Variable Security**: Sensitive data stored as environment variables
- **Automated Backups**: Regular user data backups with timestamped files
- **Fallback Mechanisms**: Multiple database options with graceful degradation

## Technical Architecture

### Backend Technologies

- **Node.js**: Core runtime environment
- **Express.js**: Web server for webhook integration
- **node-telegram-bot-api**: Telegram Bot API interaction
- **ethers.js**: Ethereum blockchain interaction
- **node-schedule**: Study reminder scheduling
- **qrcode**: QR code generation for shareable links
- **crypto**: AES-256 encryption for wallet security
- **Groq SDK**: AI integration for personalized responses

### Blockchain Components

- **Base Sepolia**: Ethereum L2 network for low-cost transactions
- **Smart Contracts**:
  - `SimbiToken.sol`: ERC20 token for rewards (SIMBI)
  - `SimbiBadgeNFT.sol`: ERC721 NFT for achievement badges
  - `SimbiCredentialNFT.sol`: Soulbound NFT for educational credentials
  - `SimbiQuizManager.sol`: Quiz and reward management

### Data Storage

- **PostgreSQL**: Primary database for production environments
- **SQLite**: Fallback database for development and testing
- **JSON Files**: Alternative storage for simple deployments
- **In-memory Cache**: Last-resort data persistence mechanism

## Installation

### Prerequisites

- Node.js 16+ and npm
- Telegram Bot Token (from BotFather)
- Base Sepolia RPC URL
- Ethereum wallet with Base Sepolia ETH (for contract deployment)
- Groq API key (for AI features)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/kingsleycj/simbi-bot
   cd simbi-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment configuration:
   ```bash
   cp .env-example .env
   ```

4. Configure your `.env` file with required credentials:
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

   # Optional Database Configuration
   DATABASE_URL=<PostgreSQL connection string>
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## Database Migration

SIMBI supports both file-based and SQL database storage options:

### Migrating from JSON to PostgreSQL

1. Ensure your PostgreSQL database is configured
2. Add `DATABASE_URL` to your `.env` file
3. Run the migration:
   ```bash
   node migrate.js
   ```

### Security Migration

For existing deployments with unencrypted private keys:

```bash
node scripts/migrateToEncryption.js
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Create wallet and begin onboarding |
| `/menu` | Access main command menu |
| `/quiz` | Start a knowledge quiz |
| `/study_session` | Begin a timed study session |
| `/track_progress` | View on-chain progress and achievements |
| `/reminder` | Set study reminders |
| `/chat` | Chat with SIMBI AI assistant |
| `/wallet` | View wallet information |
| `/profile` | View and manage profile |
| `/connect` | Connect existing wallet |
| `/help` | Display help information |

## Deployment

### Render.com Deployment

1. Fork or push repository to GitHub
2. Connect to Render.com with your GitHub account
3. Create a new Web Service pointing to the repository
4. Add all environment variables from `.env`
5. Deploy the service

### Render.com Deployment Troubleshooting

If you encounter errors during deployment on Render.com, check these common issues:

1. **Missing Dependencies:** Ensure your `package.json` includes all required dependencies:
   - `sequelize` - For database ORM
   - `pg` - For PostgreSQL support
   - All other dependencies listed in this README

   If you see an error like `Cannot find package 'sequelize' imported from...`, run this command locally and push the changes:
   ```bash
   npm install sequelize pg --save
   ```

2. **Database Configuration:** If using PostgreSQL:
   - Create a PostgreSQL database in Render.com
   - Set the `DATABASE_URL` environment variable to the connection string
   - Ensure SSL is enabled in the Sequelize configuration
   - The URL format should be: `postgres://username:password@hostname:port/database`
   - Set `MIGRATE_FROM_JSON=true` to migrate users from JSON file on first run

3. **Environment Variables:** Double-check that all required environment variables are set
   - Make sure contract address variables match exactly what's in the code (e.g., `SIMBI_CONTRACT_ADDRESS` not `SIMBITOKEN_CA`)
   - Ensure the `ENCRYPTION_KEY` is set for private key security

4. **Node.js Version:** Ensure your Node.js version is set to 18 in render.yaml

### Environment Configuration

Ensure your deployment environment has:
- Sufficient memory (512MB minimum)
- Persistent storage for database files
- Network access to Telegram API and Ethereum RPC
- Proper environment variable configuration

## Troubleshooting

For common issues, refer to `TROUBLESHOOTING.md`

Common issues include:
- Webhook connection failures
- Contract transaction errors
- Token rewards not processing
- Database connectivity problems

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Telegram for the Bot API
- Hardhat for smart contract development tools
- Groq for AI API integration
- Base for L2 blockchain infrastructure

## Contact

For questions or support, please contact the Developer: [Kingsley Nweke](https://github.com/kingsleycj/) through GitHub issues.