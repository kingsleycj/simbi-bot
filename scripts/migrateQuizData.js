import { promises as fs } from 'fs';
import path from 'path';
import User from '../models/User.js';
import sequelize from '../models/index.js';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

async function migrateQuizData() {
  try {
    console.log('Starting migration of quiz data from users.json to PostgreSQL database...');
    
    // Load users from users.json
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    let jsonUsers = {};
    
    if (data.trim()) {
      jsonUsers = JSON.parse(data);
      console.log(`Loaded ${Object.keys(jsonUsers).length} users from users.json`);
    } else {
      console.log('users.json is empty');
      return;
    }
    
    // Connect to database
    try {
      await sequelize.authenticate();
      console.log('Connected to PostgreSQL database');
    } catch (dbError) {
      console.error('Failed to connect to database:', dbError);
      return;
    }
    
    // Get all users from database
    const dbUsers = await User.findAll();
    console.log(`Found ${dbUsers.length} users in PostgreSQL database`);
    
    // Create a map of chatId to database user
    const dbUserMap = {};
    dbUsers.forEach(user => {
      const plainUser = user.get({ plain: true });
      dbUserMap[plainUser.chatId] = plainUser;
    });
    
    // Update database users with quiz data from users.json
    let updatedCount = 0;
    const updatePromises = [];
    
    for (const chatId in jsonUsers) {
      const jsonUser = jsonUsers[chatId];
      
      // Skip users with no quiz data
      if (!jsonUser.completedQuizzes && !jsonUser.quizScore) {
        continue;
      }
      
      // If user exists in database
      if (dbUserMap[chatId]) {
        const dbUser = dbUserMap[chatId];
        
        // Update userData to include quiz data
        const userData = dbUser.userData || {};
        const updatedUserData = {
          ...userData,
          completedQuizzes: jsonUser.completedQuizzes || 0,
          quizScore: jsonUser.quizScore || 0
        };
        
        console.log(`Updating user ${chatId}: completedQuizzes=${jsonUser.completedQuizzes || 0}, quizScore=${jsonUser.quizScore || 0}`);
        
        // Add the update to our promises
        updatePromises.push(
          User.update(
            { userData: updatedUserData },
            { where: { chatId } }
          )
        );
        
        updatedCount++;
      }
    }
    
    // Execute all updates
    await Promise.all(updatePromises);
    
    console.log(`Successfully updated quiz data for ${updatedCount} users`);
    
    // Close database connection
    await sequelize.close();
    
  } catch (error) {
    console.error('Error migrating quiz data:', error);
  }
}

// Run the function
migrateQuizData(); 