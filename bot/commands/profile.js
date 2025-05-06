import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Path to users.json file
const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');

// Load users data
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    
    // Handle empty file case
    if (!data.trim()) {
      return {};
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

const handleProfileInfo = async (bot, chatId, msg = null) => {
  try {
    // Load users to get the wallet address
    const users = await loadUsers();
    const userInfo = users[chatId.toString()];

    // Only check if user has a wallet address, not firstName
    if (!userInfo || !userInfo.address) {
      return bot.sendMessage(
        chatId,
        "⚠️ You don't have a wallet yet. Use /start to create one.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
          }
        }
      );
    }

    // Get ID from Telegram chat ID
    const telegramId = chatId;
    
    // Use actual user data from userInfo
    const firstName = userInfo.firstName || "User";
    const lastName = userInfo.lastName || "Not provided";
    const username = userInfo.username || "Not set";
    
    const walletAddress = userInfo.address;
    
    // Calculate study stats
    let completedQuizzes = 0;
    if (userInfo.quizzes && Array.isArray(userInfo.quizzes)) {
      // Count completed quizzes from quiz history
      completedQuizzes = userInfo.quizzes.filter(quiz => quiz.completed).length;
    } else {
      // Fallback to completedQuizzes counter
      completedQuizzes = userInfo.completedQuizzes || 0;
    }
    
    const studySessions = userInfo.studySessions?.completed || 0;
    const totalStudyTime = calculateTotalStudyTime(userInfo);
    
    // Calculate account age
    const accountCreated = userInfo.createdAt ? new Date(userInfo.createdAt) : null;
    const accountAge = accountCreated ? formatAccountAge(accountCreated) : "Unknown";

    // Generate profile information
    const profileInfo = `
📱 *SIMBI User Profile*

👤 *Personal Information:*
• ID: \`${telegramId}\`
• First Name: ${firstName}
• Last Name: ${lastName}
• Username: @${username}

🧠 *Study Statistics:*
• Completed Quizzes: ${completedQuizzes}
• Study Sessions: ${studySessions}
• Total Study Time: ${totalStudyTime}
• Account Age: ${accountAge}

👛 *Wallet Information:*
• Address: \`${walletAddress}\`

💡 *Use /wallet to view detailed wallet information*
`;

    await bot.sendMessage(
      chatId,
      profileInfo,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👛 View Wallet", callback_data: "wallet" },
              { text: "📊 View Progress", callback_data: "progress" }
            ],
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error handling profile info:', error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while fetching your profile. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
  }
};

// Helper function to calculate total study time in hours/minutes
function calculateTotalStudyTime(userInfo) {
  if (!userInfo || !userInfo.studySessions) {
    return "0 minutes";
  }
  
  let totalMinutes = 0;
  
  // Use actual session history if available
  if (userInfo.studySessions.history && Array.isArray(userInfo.studySessions.history)) {
    userInfo.studySessions.history.forEach(session => {
      if (session.duration) {
        totalMinutes += session.duration;
      } else if (session.startTime && session.endTime) {
        // Calculate duration from timestamps if available
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const durationMs = end - start;
        totalMinutes += Math.floor(durationMs / (1000 * 60));
      }
    });
  } else if (userInfo.studySessions.completed) {
    // Fallback to using completed session count
    const sessions25Min = Math.floor(userInfo.studySessions.completed * 0.6); // Assume 60% are 25-min sessions
    const sessions50Min = userInfo.studySessions.completed - sessions25Min;    // Assume 40% are 50-min sessions
    
    totalMinutes += (sessions25Min * 25) + (sessions50Min * 50);
  }
  
  // Format time nicely
  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
  }
}

// Helper function to format account age
function formatAccountAge(date) {
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return `${years} year${years !== 1 ? 's' : ''}${remainingMonths > 0 ? ` ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}` : ''}`;
  }
}

export { handleProfileInfo };