import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Get database connection URL from environment variables or use SQLite as fallback
const dbUrl = process.env.DATABASE_URL;

let sequelize;

if (dbUrl) {
  console.log('Using database connection:', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://postgres:****@'));
  
  // Create Sequelize instance for PostgreSQL
sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Allow self-signed certs (Neon requires this)
    }
  }
});
} else {
  // Fallback to SQLite (for development/testing)
  console.log('No DATABASE_URL found, using SQLite database');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

// Test the connection and log status
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    console.log('ERROR DETAILS:', JSON.stringify(error, null, 2));
  }
})();

export default sequelize; 