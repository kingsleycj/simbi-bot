import { getUser, getAllUsers } from '../bot/db-adapter.js';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

async function verifyQuizData() {
  try {
    console.log('Verifying quiz data in the database...');
    
    // Get all users
    const users = await getAllUsers();
    console.log(`Found ${Object.keys(users).length} users in the database`);
    
    // Print quiz data for each user
    for (const chatId in users) {
      const user = users[chatId];
      console.log(`\nUser ${chatId}:`);
      console.log(`Wallet: ${user.walletAddress}`);
      console.log(`Quiz data from getAllUsers: completedQuizzes=${user.completedQuizzes || 0}, quizScore=${user.quizScore || 0}`);
      
      // Verify with getUser
      const individualUser = await getUser(chatId);
      console.log(`Quiz data from getUser: completedQuizzes=${individualUser.completedQuizzes || 0}, quizScore=${individualUser.quizScore || 0}`);
      
      // Check if data is consistent
      if (user.completedQuizzes !== individualUser.completedQuizzes || 
          user.quizScore !== individualUser.quizScore) {
        console.error('WARNING: Inconsistent data between getAllUsers and getUser!');
      }
    }
    
    console.log('\nVerification complete!');
  } catch (error) {
    console.error('Error verifying quiz data:', error);
  }
}

// Run the function
verifyQuizData(); 