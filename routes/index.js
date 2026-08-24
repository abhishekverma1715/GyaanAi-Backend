// ── Auth Routes ────────────────────────────────────────────────
const express  = require('express');
const authRouter = express.Router();
const auth     = require('../controllers/authController');
const { protect } = require('../middleware/auth');

authRouter.post('/register',          auth.register);
authRouter.post('/login',             auth.login);
authRouter.get('/me',         protect, auth.getMe);
authRouter.patch('/preferences', protect, auth.updatePreferences);

module.exports.authRouter = authRouter;

// ── Chat Routes ────────────────────────────────────────────────
const chatRouter = express.Router();
const chat       = require('../controllers/chatController');

chatRouter.use(protect); // All chat routes require auth

chatRouter.get('/conversations',                  chat.getConversations);
chatRouter.post('/conversations',                 chat.createConversation);
chatRouter.delete('/conversations',               chat.deleteAll);
chatRouter.get('/conversations/:id',              chat.getConversation);
chatRouter.patch('/conversations/:id',            chat.updateConversation);
chatRouter.delete('/conversations/:id',           chat.deleteConversation);
chatRouter.post('/conversations/:id/messages',    chat.sendMessage);
chatRouter.post('/conversations/:id/stream',      chat.streamMessage);
chatRouter.delete('/conversations/:id/messages',  chat.clearMessages);

module.exports.chatRouter = chatRouter;
