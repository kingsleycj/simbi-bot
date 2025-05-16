# PostgreSQL Migration Guide

This guide explains how to update the remaining command files to use the PostgreSQL database instead of the users.json file.

## What We've Already Done

1. Added PostgreSQL support to the application
2. Created a database adapter in `bot/db-adapter.js`
3. Updated all command files:
   - `bot/commands/wallet.js`
   - `bot/commands/profile.js` 
   - `bot/commands/trackProgress.js`
   - `bot/commands/quiz.js`
   - `bot/commands/study_session.js`
   - `bot/commands/connect.js`
   - `bot/commands/sync.js`
   - `bot/commands/start.js`
4. Updated `index.js` to use the database adapter functions

## Migration Complete

All command files have been updated to use the database adapter instead of directly accessing the users.json file. The migration has been completed with the following changes:

1. Removed direct file system imports (`import { promises as fs } from 'fs'`)
2. Removed the `USERS_FILE_PATH` constant
3. Replaced direct file operations with database adapter functions:
   - `loadUsers()` - Loads all users from the database
   - `saveUsers(users)` - Saves all users to the database
   - `saveUser(chatId, userData)` - Saves a single user to the database
4. Updated the main `index.js` to use the database adapter functions for all database operations

## Testing After Migration

After completing the migration:

1. Test each command directly to ensure it works correctly
2. Verify that user data is correctly retrieved from and saved to the database
3. Check the logs for any errors related to loading or saving users

## Deployment Checklist

Before deploying to Render.com:

1. Make sure all command files have been updated
2. Run the application locally with SQLite to ensure all features work correctly
3. Push the changes to GitHub
4. Deploy to Render.com with the appropriate environment variables
5. Set up UptimeRobot for the reminder checks

## Troubleshooting

If you encounter issues:

1. Check PostgreSQL connection settings in the Database tab of Render.com dashboard
2. Verify all environment variables are set correctly, especially DATABASE_URL
3. Look at the logs for error messages
4. Test with the local SQLite database first (no DATABASE_URL) 
5. If data isn't being saved properly, check that all calls to save data are using the async/await pattern correctly

## Data Migration

If you need to migrate existing data from users.json to the database:

1. Use the migration script we created earlier
2. Set appropriate environment variables:
   - For SQLite: Don't set DATABASE_URL
   - For PostgreSQL: Set DATABASE_URL to your PostgreSQL connection string

## Fallback Plan

In case of database issues, the application can still be configured to use the users.json file as a fallback by:

1. Not setting the DATABASE_URL environment variable (will use SQLite)
2. Or completely removing the DATABASE_URL environment variable (will use in-memory SQLite)

This way, even if PostgreSQL is not available, the application can continue to function. 