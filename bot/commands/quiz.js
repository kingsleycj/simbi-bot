const { ethers } = require('ethers');
const quizData = require('../../utils/quizQuestions.json');

const handleQuizCommand = (bot, users, chatId, SIMBIQUIZMANAGER_CA, PRIVATE_KEY, BASE_SEPOLIA_RPC_URL) => {
  const categories = Object.keys(quizData);
  const options = {
    reply_markup: {
      inline_keyboard: categories.map((category) => [
        { text: category.charAt(0).toUpperCase() + category.slice(1), callback_data: `quiz_${category}` }
      ])
    }
  };

  bot.sendMessage(chatId, '📝 *Choose a Quiz Category:*', { parse_mode: 'Markdown', ...options })
    .catch((error) => console.error('Error sending quiz categories:', error));

  bot.on('callback_query', (query) => {
    if (!query.data.startsWith('quiz_')) return;

    const category = query.data.split('_')[1];
    const quizzes = quizData[category];

    if (!quizzes) {
      bot.sendMessage(chatId, '❌ Invalid category. Please try again.');
      return;
    }

    const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];

    const options = {
      reply_markup: {
        inline_keyboard: quiz.options.map((option, index) => [
          { text: option, callback_data: `answer_${category}_${index}` }
        ])
      }
    };

    bot.sendMessage(chatId, `📝 *${category.charAt(0).toUpperCase() + category.slice(1)} Quiz:*

${quiz.question}`, { parse_mode: 'Markdown', ...options })
      .catch((error) => console.error('Error sending quiz question:', error));

    bot.once('callback_query', (answerQuery) => {
      const selectedOptionIndex = parseInt(answerQuery.data.split('_')[2]);
      const selectedOption = quiz.options[selectedOptionIndex];

      if (selectedOption === quiz.answer) {
        bot.sendMessage(chatId, '🎉 Correct! You earned 10 SIMBI tokens!');

        const userAddress = users[chatId]?.address;
        if (userAddress) {
          const quizManager = new ethers.Contract(
            SIMBIQUIZMANAGER_CA,
            ["function completeQuiz(address user, uint256 score) external"],
            new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL))
          );

          quizManager.completeQuiz(userAddress, 100).catch((error) => {
            console.error('Error rewarding tokens:', error);
            bot.sendMessage(chatId, '⚠️ Failed to reward tokens. Please try again later.');
          });
        }
      } else {
        bot.sendMessage(chatId, '❌ Incorrect! Better luck next time.');
      }

      bot.answerCallbackQuery(answerQuery.id).catch((error) => console.error('Error answering callback query:', error));
    });
  });
};

module.exports = { handleQuizCommand };