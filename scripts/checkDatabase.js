import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

async function checkDatabase() {
  try {
    console.log('Checking database for quiz data...');
    
    // Get database connection URL from environment variables
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      console.error('No DATABASE_URL found in environment variables');
      return;
    }
    
    console.log('Using database connection:', dbUrl.replace(/:\\/\\/[^:]+:[^@]+@/, '://postgres:****@'));
    
    // Create Sequelize instance
    const sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      }
    });
    
    // Test the connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully');
    
    // Execute a simple query to show the table structure
    const [results] = await sequelize.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'users\'');
    console.log('\nTable structure:');
    console.table(results);
    
    // Get a sample of users to check their quiz data
    const [users] = await sequelize.query('SELECT "chatId", "walletAddress", "userData" FROM users LIMIT 5');
    
    console.log('\nSample user data:');
    users.forEach(user => {
      console.log(`\nUser ${user.chatId}:`);
      console.log('Wallet:', user.walletAddress);
      
      // Parse userData JSON
      const userData = user.userData || {};
      console.log('Quiz data in userData:', {
        completedQuizzes: userData.completedQuizzes || 0,
        quizScore: userData.quizScore || 0
      });
    });
    
    // Close connection
    await sequelize.close();
    
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

// Run the function
checkDatabase(); 