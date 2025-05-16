import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const User = sequelize.define('User', {
  // Use Telegram chat ID as the primary key
  chatId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  // Wallet information
  walletAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  encryptedPrivateKey: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Study session data
  studySessionActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  studySessionStartTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  studySessionDuration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  studySessionSubject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Quiz data
  quizzesTaken: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  quizzesCorrect: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Chat mode
  inChatMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Other user data as JSON
  userData: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  // Other model options
  timestamps: true,
  // Specify the table name explicitly to avoid capitalization issues
  tableName: 'users'
});

// Note: We no longer automatically sync the model here
// This will be handled by the setup script

export default User; 