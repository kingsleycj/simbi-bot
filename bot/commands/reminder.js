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
          bot.sendMessage(chatId, '❌ Invalid time format. Please use HH:mm format.');
          return;
        }

        const [hour, minute] = time.split(':').map(Number);

        // Schedule the reminder
        const job = schedule.scheduleJob({ hour, minute }, () => {
          bot.sendMessage(chatId, '📚 Reminder: It’s time to study! Let’s achieve your goals with SIMBI!');
        });

        // Save the reminder job
        reminders[chatId] = job;

        bot.sendMessage(chatId, `✅ Reminder set for ${time}.`);
      });
    })
    .catch((error) => console.error('Error handling reminder command:', error));
};

export { handleSetReminderCommand, reminders };