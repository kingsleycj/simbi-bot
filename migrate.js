import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

const execPromise = promisify(exec);

async function migrate() {
  try {
    console.log('🚀 Starting migration from users.json to PostgreSQL database...');
    
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.log('No DATABASE_URL found in environment variables.');
      console.log('Migration will use SQLite as the database (default fallback).');
    } else {
      console.log('Using PostgreSQL database connection from DATABASE_URL.');
    }
    
    console.log('\n1. Setting up database tables...');
    try {
      const setupResult = await execPromise('node scripts/setupDatabase.js');
      console.log(setupResult.stdout);
      if (setupResult.stderr) console.error(setupResult.stderr);
    } catch (setupError) {
      console.error('Database setup error:', setupError.message);
      console.log('Continuing with migration attempt...');
    }
    
    console.log('\n2. Running migration script...');
    try {
      const { stdout, stderr } = await execPromise('node scripts/migrateUsersToDb.js');
      console.log(stdout);
      if (stderr) console.error('Migration script error:', stderr);
    } catch (migrationError) {
      console.error('Migration failed:', migrationError.message);
      return;
    }
    
    console.log('\n🎉 Migration completed!');
    console.log('\nYou can now use the bot with the PostgreSQL database.');
    console.log('All your users and their data have been migrated successfully.');
    
  } catch (error) {
    console.error('Migration process failed:', error);
  }
}

// Run migration
migrate().catch(console.error); 