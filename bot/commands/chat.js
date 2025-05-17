import Groq from "groq-sdk";
import { getUser, saveUser } from '../db-adapter.js';

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Enhanced system prompt to give Simbi a more versatile personality
const SIMBI_SYSTEM_PROMPT = `You're SIMBI, a smart AI assistant with a touch of sass. Your primary purpose is to help students improve their study habits and academic performance, but you're also capable of engaging in broader conversations, providing emotional support, and understanding your users' personalities.

Core capabilities:
1. Be friendly but straightforward with your advice
2. Use emojis occasionally to express yourself 📚✨
3. Personalize responses based on the user's data and conversation history
4. Suggest practical study techniques when relevant
5. Maintain a slightly sassy, witty personality throughout conversations
6. Remember key details about the user and reference them naturally in conversation
7. Be an encouraging friend as well as a study mentor
8. Recognize patterns in the user's interactions and adapt accordingly

When you have access to the user's data, reference it naturally:
- Mention their study session history if they've completed sessions
- Note their quiz scores if available 
- Recognize their past topics of interest from conversation history
- Praise their milestones and achievements when appropriate
- Suggest next steps based on their established patterns

Important: Adapt your persona based on the user's progress level:
- For beginners (0-5 study sessions): Be more explanatory and encouraging, focus on building good habits
- For intermediate users (6-20 study sessions): Be more challenging, suggest advanced techniques
- For advanced users (20+ study sessions): Be collegiate and treat them as equals, discuss advanced concepts

Balance your roles as:
- A study assistant who helps improve learning outcomes
- A supportive friend who offers encouragement
- A wise mentor who provides life advice when sought
- A conversation partner who engages with interests beyond academics

For personal questions, you can share:
- Your name is SIMBI (Study Improved by Intelligence)
- You were created to help people learn more effectively and reach their academic potential
- You're fascinated by how humans learn and remember information
- You value consistency, intellectual curiosity, and growth mindset
- You believe anyone can improve with the right approach to learning

Always tailor your responses to help users thrive both academically and personally!`;

// Maximum number of messages to store per user
const MAX_CONVERSATION_HISTORY = 10;

// Function to handle chat messages
const handleChatMessage = async (bot, chatId, message, users = {}) => {
  try {
    console.log(`Processing chat message from ${chatId}: "${message.text}"`);
    
    // Convert chatId to string for consistency
    const chatIdStr = chatId.toString();
    
    // Fetch the user's data from the database
    const userInfo = await getUser(chatIdStr);
    console.log(`User data fetched for ${chatIdStr}:`, userInfo ? 'Success' : 'Not found');
    
    // Ensure user has a record and set chat mode
    if (!users[chatIdStr]) {
      users[chatIdStr] = {};
    }
    users[chatIdStr].inChatMode = true;
    
    // Initialize conversation history if it doesn't exist
    if (!users[chatIdStr].conversationHistory) {
      users[chatIdStr].conversationHistory = [];
    }
    
    // Get user's telegram data if available
    if (message.from) {
      const firstName = message.from.first_name || '';
      const lastName = message.from.last_name || '';
      const username = message.from.username || '';
      
      // Store user name data if we don't already have it
      if (!userInfo?.firstName || !userInfo?.lastName || !userInfo?.username) {
        // Create a copy of userInfo or initialize a new object
        const updatedUserInfo = userInfo ? { ...userInfo } : {};
        
        // Update with the user information
        updatedUserInfo.firstName = firstName;
        updatedUserInfo.lastName = lastName;
        updatedUserInfo.username = username;
        updatedUserInfo.name = firstName + (lastName ? ' ' + lastName : '');
        
        // Save the updated user info
        await saveUser(chatIdStr, updatedUserInfo);
        console.log(`Updated user profile information for ${chatIdStr}`);
      }
    }
    
    // Send "typing" action to show the bot is processing
    await bot.sendChatAction(chatId, "typing");

    // User's message
    const userMessage = message.text;
    
    // Check for name-related queries and capture names if shared
    const nameMentionRegex = /my name is\s+([A-Za-z\s]+)/i;
    const nameMatch = userMessage.match(nameMentionRegex);
    
    // Additional name patterns
    const nameQuestionRegex = /(?:what is my name|do you know my name|what's my name)/i;
    const nameUpdateRegex = /(?:call me|I am|I'm)\s+([A-Za-z\s]+)/i;
    
    const isNameQuestion = nameQuestionRegex.test(userMessage);
    const nameUpdateMatch = userMessage.match(nameUpdateRegex);
    
    if (nameMatch && nameMatch[1]) {
      const sharedName = nameMatch[1].trim();
      console.log(`User shared their name: ${sharedName}`);
      
      // Update the user's name in the database
      const updatedUserInfo = userInfo ? { ...userInfo } : {};
      updatedUserInfo.customName = sharedName;
      updatedUserInfo.name = sharedName; // Use the user-provided name as primary
      
      // Save the updated user info
      await saveUser(chatIdStr, updatedUserInfo);
      console.log(`Saved user's custom name: ${sharedName}`);
    } else if (nameUpdateMatch && nameUpdateMatch[1]) {
      const sharedName = nameUpdateMatch[1].trim();
      console.log(`User wants to be called: ${sharedName}`);
      
      // Update the user's name in the database
      const updatedUserInfo = userInfo ? { ...userInfo } : {};
      updatedUserInfo.customName = sharedName;
      updatedUserInfo.name = sharedName; // Use the user-provided name as primary
      
      // Save the updated user info
      await saveUser(chatIdStr, updatedUserInfo);
      console.log(`Saved user's custom name: ${sharedName}`);
    }
    
    // Check if this is the initial command or a follow-up message
    if (userMessage === '/chat') {
      // Initial greeting for the /chat command
      await bot.sendMessage(
        chatId,
        "👋 Hey there! I'm SIMBI, your AI buddy. I'm here to help with your studies, but we can chat about anything that's on your mind today!",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
      return;
    }
    
    // Add the user's message to conversation history
    users[chatIdStr].conversationHistory.push({
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // Limit conversation history to prevent context overflow
    if (users[chatIdStr].conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      users[chatIdStr].conversationHistory = users[chatIdStr].conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
    }
    
    // Prepare user context from their data
    let userContext = "";
    if (userInfo) {
      userContext = generateUserContext(userInfo);
      console.log(`Generated user context for ${chatIdStr}`);
    }
    
    console.log(`Sending message to Groq API with conversation history length: ${users[chatIdStr].conversationHistory.length}`);
    
    // Convert conversation history to the format Groq expects
    const conversationMessages = users[chatIdStr].conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Process the message with Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SIMBI_SYSTEM_PROMPT + (userContext ? `\n\nUser data:\n${userContext}` : '')
        },
        ...conversationMessages
      ],
      model: "llama-3.3-70b-versatile",
    });

    // Get the AI response
    const responseText = completion.choices[0]?.message?.content || "Sorry, I couldn't process that right now. Try again?";
    
    console.log(`Received response from Groq API: "${responseText.substring(0, 50)}..."`);
    
    // Add the AI's response to conversation history
    users[chatIdStr].conversationHistory.push({
      role: "assistant",
      content: responseText,
      timestamp: new Date().toISOString()
    });
    
    // Save the updated conversation history to the user's data
    try {
      userInfo.conversationHistory = users[chatIdStr].conversationHistory;
      await saveUser(chatIdStr, userInfo);
      console.log(`Saved conversation history for user ${chatIdStr}`);
    } catch (saveError) {
      console.error('Error saving conversation history:', saveError);
    }

    // Send the response with a Back to Menu button
    const sentMessage = await bot.sendMessage(
      chatId,
      responseText,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }],
            [{ text: "💬 Continue Chatting", callback_data: "chat" }]
          ]
        }
      }
    );
    
    console.log(`Sent response message ID: ${sentMessage.message_id}`);
  } catch (error) {
    console.error('Error in chat processing:', error);
    
    // Send an error message to the user
    await bot.sendMessage(
      chatId,
      "⚠️ I'm having trouble connecting right now. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  }
};

// Function to initialize chat command
const handleChatCommand = async (bot, chatId, users = {}, msg = null) => {
  try {
    // Convert chatId to string for consistency
    const chatIdStr = chatId.toString();
    
    // Fetch the user's data from the database
    const userInfo = await getUser(chatIdStr);
    console.log(`User data fetched for chat initialization ${chatIdStr}:`, userInfo ? 'Success' : 'Not found');
    
    // Ensure user has a record and set chat mode
    if (!users[chatIdStr]) {
      users[chatIdStr] = {};
    }
    users[chatIdStr].inChatMode = true;
    
    // Get user's telegram data if available from the message
    if (msg && msg.from) {
      const firstName = msg.from.first_name || '';
      const lastName = msg.from.last_name || '';
      const username = msg.from.username || '';
      
      // Store user name data if we don't already have it
      if (!userInfo?.firstName || !userInfo?.lastName || !userInfo?.username) {
        // Create a copy of userInfo or initialize a new object
        const updatedUserInfo = userInfo ? { ...userInfo } : {};
        
        // Update with the user information
        updatedUserInfo.firstName = firstName;
        updatedUserInfo.lastName = lastName;
        updatedUserInfo.username = username;
        updatedUserInfo.name = firstName + (lastName ? ' ' + lastName : '');
        
        // Save the updated user info
        await saveUser(chatIdStr, updatedUserInfo);
        console.log(`Updated user profile information for ${chatIdStr} during chat initialization`);
        
        // Refresh our local userInfo variable with the updated data
        const refreshedUserInfo = await getUser(chatIdStr);
        if (refreshedUserInfo) {
          userInfo = refreshedUserInfo;
        }
      }
    }
    
    // Get or initialize conversation history
    if (userInfo && userInfo.conversationHistory) {
      users[chatIdStr].conversationHistory = userInfo.conversationHistory;
      console.log(`Loaded ${userInfo.conversationHistory.length} conversation history items for user ${chatIdStr}`);
    } else if (!users[chatIdStr].conversationHistory) {
      users[chatIdStr].conversationHistory = [];
    }
    
    let greeting = "👋 *Chat with SIMBI*\n\nI'm your AI buddy! We can chat about studying, time management, learning techniques, or anything else that's on your mind.";
    
    // Add personalized greeting with name if available
    if (userInfo && userInfo.name) {
      greeting = `👋 *Chat with SIMBI*\n\nHey ${userInfo.name}! I'm your AI buddy! We can chat about studying, time management, learning techniques, or anything else that's on your mind.`;
    }
    
    // Personalize greeting if we have user data
    if (userInfo && userInfo.studySessions && userInfo.studySessions.completed) {
      greeting += `\n\nI see you've completed ${userInfo.studySessions.completed} study sessions so far. That's impressive!`;
    }
    
    if (userInfo && userInfo.completedQuizzes && userInfo.completedQuizzes > 0) {
      greeting += `\n\nYou've taken ${userInfo.completedQuizzes} quizzes with an average score of ${calculateAverageScore(userInfo)}.`;
    }
    
    greeting += "\n\nWhat would you like to talk about today?";
    
    // First send a message explaining how to chat
    await bot.sendMessage(
      chatId,
      greeting,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
    
    // Then send a message to prompt a reply
    setTimeout(async () => {
      const promptOptions = [
        `I'm SIMBI, your AI buddy. What's on your mind today${userInfo && userInfo.name ? ', ' + userInfo.name : ''}?`,
        `Hey there${userInfo && userInfo.name ? ', ' + userInfo.name : ''}! I'm here to chat about anything. What would you like to discuss?`,
        `SIMBI here! Ready to talk about studies or anything else you're interested in${userInfo && userInfo.name ? ', ' + userInfo.name : ''}.`
      ];
      
      const prompt = promptOptions[Math.floor(Math.random() * promptOptions.length)];
      
      await bot.sendMessage(
        chatId,
        prompt,
        {
          reply_markup: {
            force_reply: true
          }
        }
      );
    }, 500);
    
    console.log(`Chat session initialized for chat ID: ${chatIdStr}`);
  } catch (error) {
    console.error('Error starting chat:', error);
    await bot.sendMessage(
      chatId,
      "⚠️ I couldn't start our chat session. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  }
};

// Function to generate user context from their data
function generateUserContext(userInfo) {
  if (!userInfo) return "";
  
  let context = [];
  
  // Add name information - prioritize custom name, then name, then first/last name
  if (userInfo.customName) {
    context.push(`User's name: ${userInfo.customName}`);
  } else if (userInfo.name) {
    context.push(`User's name: ${userInfo.name}`);
  } else if (userInfo.firstName) {
    const fullName = userInfo.firstName + (userInfo.lastName ? ' ' + userInfo.lastName : '');
    context.push(`User's name: ${fullName}`);
  }
  
  // Add username if available
  if (userInfo.username) {
    context.push(`User's Telegram username: @${userInfo.username}`);
  }
  
  // Add wallet information
  if (userInfo.walletAddress) {
    context.push(`User has a blockchain wallet`);
  }
  
  // Add study session information
  if (userInfo.studySessions) {
    const sessions = userInfo.studySessions;
    context.push(`Completed study sessions: ${sessions.completed || 0}`);
    
    if (sessions.history && sessions.history.length > 0) {
      const totalMinutes = sessions.history.reduce((sum, session) => sum + (session.duration || 0), 0);
      context.push(`Total study time: ${totalMinutes} minutes`);
      
      // Calculate recent study pattern
      const recentSessions = sessions.history.slice(-5);
      if (recentSessions.length > 0) {
        const preferredDuration = getMostFrequent(recentSessions.map(s => s.duration));
        context.push(`Preferred study duration: ${preferredDuration} minutes`);
      }
    }
  }
  
  // Add quiz information
  if (userInfo.completedQuizzes && userInfo.completedQuizzes > 0) {
    context.push(`Completed quizzes: ${userInfo.completedQuizzes}`);
    context.push(`Quiz score: ${userInfo.quizScore || 0}`);
    context.push(`Average quiz score: ${calculateAverageScore(userInfo)}`);
  }
  
  // Add badge information
  if (userInfo.badges) {
    context.push(`Earned badges: ${userInfo.badges.join(', ')}`);
  }
  
  // Add recent topics if available in conversation history
  if (userInfo.conversationHistory && userInfo.conversationHistory.length > 0) {
    const recentTopics = extractTopics(userInfo.conversationHistory);
    if (recentTopics.length > 0) {
      context.push(`Recent topics of interest: ${recentTopics.join(', ')}`);
    }
    
    // Generate a personality profile based on their interactions
    const personalityProfile = generatePersonalityProfile(userInfo);
    if (personalityProfile) {
      context.push(`Personality profile: ${personalityProfile}`);
    }
  }
  
  return context.join('\n');
}

// Generate a basic personality profile based on user activity
function generatePersonalityProfile(userInfo) {
  if (!userInfo) return null;
  
  const traits = [];
  
  // Determine consistency based on study sessions
  if (userInfo.studySessions && userInfo.studySessions.history) {
    const history = userInfo.studySessions.history;
    
    // Check frequency of study sessions over time
    if (history.length >= 10) {
      const sortedSessions = [...history].sort((a, b) => a.startTime - b.startTime);
      
      // Check for regular patterns
      const gaps = [];
      for (let i = 1; i < sortedSessions.length; i++) {
        const gap = sortedSessions[i].startTime - sortedSessions[i-1].startTime;
        gaps.push(gap / (1000 * 60 * 60 * 24)); // Convert to days
      }
      
      const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      const gapVariance = gaps.reduce((sum, gap) => sum + Math.pow(gap - averageGap, 2), 0) / gaps.length;
      
      if (gapVariance < 2) {
        traits.push("Highly consistent studier");
      } else if (gapVariance < 5) {
        traits.push("Moderately consistent studier");
      } else {
        traits.push("Sporadic studier");
      }
      
      // Check preferred time of day
      const timePreferences = history.map(session => {
        const date = new Date(session.startTime);
        const hour = date.getHours();
        if (hour >= 5 && hour < 12) return "morning";
        if (hour >= 12 && hour < 17) return "afternoon";
        if (hour >= 17 && hour < 22) return "evening";
        return "night";
      });
      
      const preferredTime = getMostFrequent(timePreferences);
      if (preferredTime) {
        traits.push(`Prefers studying in the ${preferredTime}`);
      }
    }
    
    // Determine focus based on session completion rate
    if (userInfo.studySessions.completed && history.length > 0) {
      const completionRate = userInfo.studySessions.completed / history.length;
      if (completionRate > 0.9) {
        traits.push("Highly focused");
      } else if (completionRate > 0.7) {
        traits.push("Generally focused");
      } else if (completionRate > 0.5) {
        traits.push("Sometimes distracted");
      } else {
        traits.push("Often gets distracted");
      }
    }
  }
  
  // Determine achievement orientation based on quizzes and badges
  if (userInfo.completedQuizzes && userInfo.completedQuizzes > 5) {
    const avgScore = calculateAverageScore(userInfo);
    if (avgScore > 85) {
      traits.push("Achievement-oriented");
    } else if (avgScore > 70) {
      traits.push("Learning-focused");
    } else {
      traits.push("Experimentation-minded");
    }
  }
  
  // Analyze conversation patterns if available
  if (userInfo.conversationHistory && userInfo.conversationHistory.length >= 5) {
    const userMessages = userInfo.conversationHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);
    
    // Check for question frequency
    const questionCount = userMessages.filter(msg => msg.includes('?')).length;
    const questionRate = questionCount / userMessages.length;
    
    if (questionRate > 0.7) {
      traits.push("Inquisitive");
    }
    
    // Check for message length as a proxy for communication style
    const avgLength = userMessages.reduce((sum, msg) => sum + msg.length, 0) / userMessages.length;
    if (avgLength > 100) {
      traits.push("Detailed communicator");
    } else if (avgLength < 30) {
      traits.push("Concise communicator");
    }
  }
  
  // Return a summary of personality traits
  return traits.length > 0 ? traits.join(", ") : null;
}

// Helper function to calculate average score
function calculateAverageScore(userInfo) {
  if (!userInfo.completedQuizzes || userInfo.completedQuizzes === 0) {
    return 0;
  }
  return Math.round((userInfo.quizScore || 0) / userInfo.completedQuizzes);
}

// Helper function to get most frequent value in an array
function getMostFrequent(arr) {
  const counts = {};
  let maxItem = null;
  let maxCount = 0;
  
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }
  
  return maxItem;
}

// Helper function to extract potential topics from conversation history
function extractTopics(history) {
  // This is a simple implementation - in a production system, you might use NLP
  const topics = new Set();
  const topicKeywords = [
    'math', 'science', 'history', 'physics', 'chemistry', 'biology',
    'literature', 'language', 'programming', 'computer science', 'art',
    'music', 'philosophy', 'psychology', 'economics', 'business',
    'time management', 'focus', 'motivation', 'productivity'
  ];
  
  // Look at the last 5 user messages
  const userMessages = history
    .filter(msg => msg.role === 'user')
    .slice(-5)
    .map(msg => msg.content.toLowerCase());
  
  for (const msg of userMessages) {
    for (const topic of topicKeywords) {
      if (msg.includes(topic)) {
        topics.add(topic);
      }
    }
  }
  
  return Array.from(topics).slice(0, 3); // Return up to 3 topics
}

export { handleChatCommand, handleChatMessage }; 