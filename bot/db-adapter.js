import User from '../models/User.js';

// In-memory cache for faster access and fallback in case of database issues
let usersCache = {};

/**
 * Get a user by chat ID
 * @param {string} chatId - Telegram chat ID
 * @returns {Object|null} User data or null if not found
 */
export async function getUser(chatId) {
  if (!chatId) {
    console.error('Invalid chatId provided to getUser:', chatId);
    return null;
  }
  
  try {
    // Try to get from database first
    const user = await User.findByPk(chatId);
    if (user) {
      // Create combined user data object with userData fields accessible directly
      const plainUser = user.get({ plain: true });
      const userData = plainUser.userData || {};
      
      const combinedUserData = {
        ...plainUser,
        ...userData,
        // Ensure these fields are directly accessible, with proper fallbacks
        completedQuizzes: userData.completedQuizzes || plainUser.completedQuizzes || 0,
        quizScore: userData.quizScore || plainUser.quizScore || 0
      };
      
      // Update cache
      usersCache[chatId] = combinedUserData;
      return combinedUserData;
    }
    
    // If not in database, check cache
    if (usersCache[chatId]) {
      console.log(`User ${chatId} found in cache but not in database`);
      return usersCache[chatId];
    }
    
    console.log(`User ${chatId} not found in database or cache`);
    return null;
  } catch (error) {
    console.error(`Error getting user ${chatId} from database:`, error);
    
    // If database query fails, try to return from cache
    if (usersCache[chatId]) {
      console.log(`Returning user ${chatId} from cache due to database error`);
      return usersCache[chatId];
    }
    
    return null;
  }
}

/**
 * Get all users
 * @returns {Object} Map of users with chat IDs as keys
 */
export async function getAllUsers() {
  try {
    const users = await User.findAll();
    const usersMap = {};
    
    users.forEach(user => {
      const plainUser = user.get({ plain: true });
      const userData = plainUser.userData || {};
      
      usersMap[plainUser.chatId] = {
        ...plainUser,
        ...userData,
        // Ensure these fields are directly accessible, with proper fallbacks
        completedQuizzes: userData.completedQuizzes || plainUser.completedQuizzes || 0,
        quizScore: userData.quizScore || plainUser.quizScore || 0
      };
    });
    
    // Update cache with new data
    usersCache = { ...usersCache, ...usersMap };
    
    return usersMap;
  } catch (error) {
    console.error('Error getting all users from database:', error);
    
    // If database query fails, return the cache
    if (Object.keys(usersCache).length > 0) {
      console.log('Returning users from cache due to database error');
      return { ...usersCache };
    }
    
    return {};
  }
}

/**
 * Save or update a user
 * @param {string} chatId - Telegram chat ID
 * @param {Object} userData - User data to save
 * @returns {boolean} Success status
 */
export async function saveUser(chatId, userData) {
  if (!chatId) {
    console.error('Invalid chatId provided to saveUser:', chatId);
    return false;
  }
  
  try {
    // Extract the fields that have dedicated columns
    const {
      walletAddress,
      encryptedPrivateKey,
      studySessionActive,
      studySessionStartTime,
      studySessionDuration,
      studySessionSubject,
      quizzesTaken,
      quizzesCorrect,
      inChatMode,
      address, // Alias for walletAddress
      completedQuizzes, // New field for quiz tracking
      quizScore, // New field for quiz score tracking
      ...otherData
    } = userData;

    // Create object for database update
    const userDataForDb = {
      chatId,
      walletAddress: walletAddress || address, // Support both field names
      encryptedPrivateKey,
      studySessionActive: studySessionActive || false,
      studySessionStartTime: studySessionStartTime || null,
      studySessionDuration: studySessionDuration || null,
      studySessionSubject: studySessionSubject || null,
      quizzesTaken: quizzesTaken || 0,
      quizzesCorrect: quizzesCorrect || 0,
      inChatMode: inChatMode || false,
      userData: {
        ...otherData,
        // Put quiz data fields in userData to ensure they're saved
        completedQuizzes,
        quizScore
      }
    };
    
    // Update cache immediately
    usersCache[chatId] = { 
      ...userDataForDb, 
      ...otherData,
      // Ensure quiz data is directly accessible in the cache
      completedQuizzes: completedQuizzes || 0,
      quizScore: quizScore || 0
    };

    // Update or create the user in database
    await User.upsert(userDataForDb);
    console.log(`User ${chatId} saved successfully`);

    return true;
  } catch (error) {
    console.error(`Error saving user ${chatId} to database:`, error);
    
    // Even if database save fails, we've already updated the cache
    console.log(`User ${chatId} saved to cache only`);
    return false;
  }
}

// Compatibility layer for old code that uses loadUsers and saveUsers
export async function loadUsers() {
  try {
    const users = await getAllUsers();
    
    // If database returned empty but we have cache, use cache
    if (Object.keys(users).length === 0 && Object.keys(usersCache).length > 0) {
      console.log('Database returned empty users object, using cache');
      return { ...usersCache };
    }
    
    return users;
  } catch (error) {
    console.error('Error in loadUsers compatibility function:', error);
    
    // If all else fails, return cache
    if (Object.keys(usersCache).length > 0) {
      console.log('Returning users from cache due to loadUsers error');
      return { ...usersCache };
    }
    
    return {};
  }
}

export async function saveUsers(users) {
  if (!users || typeof users !== 'object') {
    console.error('Invalid users object provided to saveUsers:', users);
    return false;
  }
  
  try {
    // Save each user in the users object
    const promises = [];
    for (const chatId in users) {
      // Update cache immediately
      usersCache[chatId] = users[chatId];
      // Queue database updates
      promises.push(saveUser(chatId, users[chatId]));
    }
    
    // Wait for all saves to complete
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error in saveUsers compatibility function:', error);
    return false;
  }
}

// Preload cache on module import
(async () => {
  try {
    // Explicitly call getAllUsers to populate the cache properly
    const users = await getAllUsers();
    console.log(`Preloaded ${Object.keys(users).length} users into cache`);
    
    // Ensure we log a sample user's completedQuizzes for verification
    if (Object.keys(users).length > 0) {
      const sampleChatId = Object.keys(users)[0];
      console.log(`Sample user quiz data: completedQuizzes=${users[sampleChatId].completedQuizzes}, quizScore=${users[sampleChatId].quizScore}`);
    }
  } catch (error) {
    console.error('Failed to preload users cache:', error);
  }
})();

export default {
  getUser,
  getAllUsers,
  saveUser,
  loadUsers,
  saveUsers
}; 