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

async function setupDatabase() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Force: false to not drop tables if they exist
    console.log('Syncing User model with database...');
    await User.sync({ alter: true });
    console.log('User model synchronized successfully');
    
    console.log('Database setup complete!');
    console.log('You can now run the migration script with: node scripts/migrateUsersToDb.js');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run setup
setupDatabase().catch(console.error); 