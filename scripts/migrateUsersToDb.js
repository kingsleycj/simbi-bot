import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import User from '../models/User.js';
import sequelize from '../models/index.js';

// Initialize dotenv
dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

async function migrateUsersToDb() {
  try {
    console.log('Starting migration from users.json to PostgreSQL database...');
    
    // Load users from users.json
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    let users = {};
    
    if (data.trim()) {
      users = JSON.parse(data);
    } else {
      console.log('users.json is empty, nothing to migrate');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // Make a backup of users.json
    const backupPath = `${USERS_FILE_PATH}.backup-${Date.now()}`;
    await fs.writeFile(backupPath, data);
    console.log(`Backup created at: ${backupPath}`);
    
    // Wait for database connection
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    // Migrate each user
    for (const chatId in users) {
      try {
        const userData = users[chatId];
        
        // Extract fields that map to dedicated columns
        const {
          walletAddress,
          address, // Alternative to walletAddress
          privateKey, // Will be stored as encryptedPrivateKey
          studySessionActive,
          studySessionStartTime,
          studySessionDuration,
          studySessionSubject,
          completedQuizzes, // Maps to quizzesTaken
          quizScore, // Maps to quizzesCorrect
          score, // Alternative to quizScore
          inChatMode,
          ...otherData
        } = userData;
        
        // Create object for database insert
        const userDataForDb = {
          chatId,
          walletAddress: walletAddress || address, // Support both field names
          encryptedPrivateKey: privateKey,
          studySessionActive: studySessionActive || false,
          studySessionStartTime: studySessionStartTime || null,
          studySessionDuration: studySessionDuration || null,
          studySessionSubject: studySessionSubject || null,
          quizzesTaken: completedQuizzes || 0,
          quizzesCorrect: quizScore || score || 0,
          inChatMode: inChatMode || false,
          userData: otherData // Store all other fields in the userData JSON column
        };
        
        // Update or create user in database
        await User.upsert(userDataForDb);
        console.log(`User ${chatId} migrated successfully`);
        migratedCount++;
      } catch (userError) {
        console.error(`Error migrating user ${chatId}:`, userError);
        errorCount++;
      }
    }
    
    console.log('Migration complete!');
    console.log(`- Successfully migrated users: ${migratedCount}`);
    console.log(`- Failed migrations: ${errorCount}`);
    console.log(`- Total users processed: ${Object.keys(users).length}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run migration
migrateUsersToDb().catch(console.error); 