const handleHumor = (bot, chatId) => {
  const jokes = [
    "😂 Why don’t skeletons fight each other? They don’t have the guts.",
    "🤣 Why did the scarecrow win an award? Because he was outstanding in his field!",
    "😄 What do you call fake spaghetti? An impasta!"
  ];

  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  bot.sendMessage(chatId, randomJoke)
    .catch((error) => {
      console.error('Error sending humor:', error);
    });
};

module.exports = { handleHumor };