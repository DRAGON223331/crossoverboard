// Constants shared by the chat API (lib/chat.js) and the chat page, so the
// server and the browser can never disagree about them.

module.exports = {
  MAX_LEN: 1000, // characters per message
  REPLY_SNIPPET: 100, // characters of the original kept inside a reply quote
  // Quick reactions. The server rejects anything that is not in this list.
  REACTIONS: ['👍', '❤️', '😂', '😮', '😢', '🔥'],
};
