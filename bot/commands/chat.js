import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// System prompt to give Simbi its personality
const SIMBI_SYSTEM_PROMPT = `You're SIMBI, a sassy and smart AI study assistant. Your purpose is to help students improve their study habits and academic performance. You should:

1. Be friendly but straightforward with advice
2. Use emojis occasionally to express yourself 📚✨
3. Keep responses concise and focused on helping the user study better
4. Occasionally mention the benefits of consistent study habits and time management
5. If asked about tokens or rewards, refer users to use the quiz feature on the bot
6. Be encouraging but realistic about study challenges
7. Suggest practical study techniques when relevant
8. Maintain a slightly sassy, witty personality throughout conversations
9. Avoid being overly formal - you're a friendly study buddy, not a professor
10. Remember your name is SIMBI (Study Improved by Intelligence)

Always tailor your responses to help users become better students!`;

// Function to handle chat messages
const handleChatMessage = async (bot, chatId, message) => {
  try {
    // Send "typing" action to show the bot is processing
    await bot.sendChatAction(chatId, "typing");

    // User's message
    const userMessage = message.text;
    
    // Check if this is the initial command or a follow-up message
    if (userMessage === '/chat') {
      // Initial greeting for the /chat command
      await bot.sendMessage(
        chatId,
        "👋 Hey there! I'm SIMBI, your AI study buddy. How can I help with your studies today?",
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

    // Process the message with Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SIMBI_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      model: "llama-3.3-70b-versatile",
    });

    // Get the AI response
    const responseText = completion.choices[0]?.message?.content || "Sorry, I couldn't process that right now. Try again?";

    // Send the response with a Back to Menu button
    await bot.sendMessage(
      chatId,
      responseText,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
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
const handleChatCommand = async (bot, chatId) => {
  try {
    await bot.sendMessage(
      chatId,
      "👋 Hey there! I'm SIMBI, your AI study buddy. Ask me anything about studying, time management, or learning techniques!",
      {
        reply_markup: {
          force_reply: true,
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
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

export { handleChatCommand, handleChatMessage }; 