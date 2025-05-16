import User from '../models/User.js';
import sequelize from '../models/index.js';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

async function fixDatabaseSchema() {
  try {
    console.log('Starting database schema fix...');
    
    // Connect to database
    try {
      await sequelize.authenticate();
      console.log('Connected to PostgreSQL database');
    } catch (dbError) {
      console.error('Failed to connect to database:', dbError);
      return;
    }
    
    // Ensure the table has the correct schema
    console.log('Updating database schema...');
    await User.sync({ alter: true });
    console.log('Database schema updated');
    
    // Get all users from database
    const users = await User.findAll();
    console.log(`Found ${users.length} users in PostgreSQL database`);
    
    // Loop through users and ensure consistent data format
    let updatedCount = 0;
    
    for (const user of users) {
      let needsUpdate = false;
      const userData = user.userData || {};
      const updatedUserData = { ...userData };
      
      // Fix case where completedQuizzes or quizScore are in the user but not in userData
      if (user.get('completedQuizzes') !== undefined && userData.completedQuizzes === undefined) {
        updatedUserData.completedQuizzes = user.get('completedQuizzes');
        needsUpdate = true;
      }
      
      if (user.get('quizScore') !== undefined && userData.quizScore === undefined) {
        updatedUserData.quizScore = user.get('quizScore');
        needsUpdate = true;
      }
      
      // Update if needed
      if (needsUpdate) {
        console.log(`Fixing data format for user ${user.chatId}: completedQuizzes=${updatedUserData.completedQuizzes}, quizScore=${updatedUserData.quizScore}`);
        user.set('userData', updatedUserData);
        await user.save();
        updatedCount++;
      }
    }
    
    console.log(`Successfully fixed data format for ${updatedCount} users`);
    
    // Close database connection
    await sequelize.close();
    
  } catch (error) {
    console.error('Error fixing database schema:', error);
  }
}

// Run the function
fixDatabaseSchema(); 