// This module handles the reminder command for the SIMBI bot.
// It allows users to set reminders for study sessions and sends notifications at the specified time.
import schedule from 'node-schedule';

const reminders = {}; // Store reminders for each user

const handleSetReminderCommand = (bot, chatId) => {
  bot.sendMessage(chatId, '⏰ Please enter the time for your reminder (e.g., 14:30 for 2:30 PM):', { reply_markup: { force_reply: true } })
    .then((sentMessage) => {
      bot.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, (reply) => {
        const time = reply.text.trim();

        // Validate time format (HH:mm)
        const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(time)) {
          bot.sendMessage(
            chatId, 
            '❌ Invalid time format. Please use HH:mm format.',
            {
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
              }
            }
          );
          return;
        }

        const [hour, minute] = time.split(':').map(Number);

        // Schedule the reminder
        const job = schedule.scheduleJob({ hour, minute }, () => {
          bot.sendMessage(
            chatId, 
            "📚 Reminder: Your exam won't be impressed by your binge-watching streak.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "📚 Start Study Session", callback_data: "study_session" },
                    { text: "🔙 Menu", callback_data: "menu" }
                  ]
                ]
              }
            }
          );
        });

        // Save the reminder job
        reminders[chatId] = job;

        bot.sendMessage(
          chatId, 
          `✅ Your reminder is set for ${time}. Miss it and I just might cry.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⏰ Set Another Reminder", callback_data: "reminder" },
                  { text: "🔙 Back to Menu", callback_data: "menu" }
                ]
              ]
            }
          }
        );
      });
    })
    .catch((error) => console.error('Error handling reminder command:', error));
};

// Handle list reminders request
const handleListReminders = (bot, chatId) => {
  const userReminder = reminders[chatId];
  
  if (!userReminder) {
    bot.sendMessage(
      chatId, 
      "❌ You don't have any active reminders.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⏰ Set a Reminder", callback_data: "reminder" },
              { text: "🔙 Back to Menu", callback_data: "menu" }
            ]
          ]
        }
      }
    );
    return;
  }
  
  const nextInvocation = userReminder.nextInvocation();
  const formattedTime = nextInvocation ? 
    `${nextInvocation.getHours().toString().padStart(2, '0')}:${nextInvocation.getMinutes().toString().padStart(2, '0')}` : 
    'unknown';
  
  bot.sendMessage(
    chatId, 
    `⏰ *Your Active Reminder*\n\nNext reminder: ${formattedTime}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "❌ Cancel Reminder", callback_data: "cancel_reminder" },
            { text: "🔙 Back to Menu", callback_data: "menu" }
          ]
        ]
      }
    }
  );
};

// Handle cancel reminder request
const handleCancelReminder = (bot, chatId) => {
  const userReminder = reminders[chatId];
  
  if (!userReminder) {
    bot.sendMessage(
      chatId, 
      "❌ You don't have any active reminders to cancel.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "menu" }]]
        }
      }
    );
    return;
  }
  
  // Cancel the job
  userReminder.cancel();
  delete reminders[chatId];
  
  bot.sendMessage(
    chatId, 
    "✅ Your reminder has been cancelled successfully.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⏰ Set New Reminder", callback_data: "reminder" },
            { text: "🔙 Back to Menu", callback_data: "menu" }
          ]
        ]
      }
    }
  );
};

export { handleSetReminderCommand, handleListReminders, handleCancelReminder, reminders };