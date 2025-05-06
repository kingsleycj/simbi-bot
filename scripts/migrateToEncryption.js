import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { encryptPrivateKey, isEncrypted } from '../bot/utils/encryption.js';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

async function migrateToEncryption() {
  try {
    console.log('Starting migration to encrypted private keys...');
    
    // Load users data
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    let users = {};
    
    if (data.trim()) {
      users = JSON.parse(data);
    }
    
    let migratedCount = 0;
    let alreadyEncryptedCount = 0;
    
    // Iterate through users and encrypt private keys
    for (const chatId in users) {
      const user = users[chatId];
      
      if (user.privateKey) {
        // Check if already encrypted
        if (isEncrypted(user.privateKey)) {
          console.log(`User ${chatId} already has an encrypted private key`);
          alreadyEncryptedCount++;
        } else {
          // Encrypt the private key
          console.log(`Encrypting private key for user ${chatId}`);
          user.privateKey = encryptPrivateKey(user.privateKey);
          migratedCount++;
        }
      }
    }
    
    // Save updated users data
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
    
    console.log('Migration complete!');
    console.log(`- Migrated users: ${migratedCount}`);
    console.log(`- Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`- Total users: ${Object.keys(users).length}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateToEncryption(); 