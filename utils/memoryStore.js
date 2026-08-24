const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { isConnected } = require('../config/db');

const users         = new Map();
const usersById     = new Map();
const conversations = new Map();

// ── User ops ──────────────────────────────────────────
async function createUser({ name, email, password }) {
  const hashed = await bcrypt.hash(password, 12);
  const id = uuid();
  const user = {
    _id: id, id, name, email, password: hashed,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
    theme: 'dark', aiProvider: 'auto', plan: 'free',
    msgCount: 0, createdAt: new Date().toISOString(),
  };
  users.set(email.toLowerCase(), user);
  usersById.set(id, user);
  return user;
}

async function findUserByEmail(email)  { return users.get(email.toLowerCase()) || null; }
async function findUserById(id)        { return usersById.get(id) || null; }
async function updateUser(id, updates) {
  const u = usersById.get(id);
  if (!u) return null;
  Object.assign(u, updates);
  users.set(u.email, u);
  usersById.set(id, u);
  return u;
}
async function matchPassword(plain, hashed) { return bcrypt.compare(plain, hashed); }

// ── Conversation ops ──────────────────────────────────
function createConversation({ userId, title = 'New Chat', model = 'auto' }) {
  const id = uuid();
  const c = {
    _id: id, id, userId, title, model, messages: [],
    pinned: false, tags: [], totalTokens: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  conversations.set(id, c);
  return c;
}

function findConvsByUser(userId) {
  return Array.from(conversations.values())
    .filter(c => c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function findConvById(id, userId) {
  const c = conversations.get(id);
  return c && c.userId === userId ? c : null;
}

function updateConv(id, userId, updates) {
  const c = conversations.get(id);
  if (!c || c.userId !== userId) return null;
  Object.assign(c, updates, { updatedAt: new Date().toISOString() });
  return c;
}

function deleteConv(id, userId) {
  const c = conversations.get(id);
  if (c && c.userId === userId) conversations.delete(id);
}

function deleteAllConvs(userId) {
  for (const [id, c] of conversations) {
    if (c.userId === userId) conversations.delete(id);
  }
}

module.exports = {
  isDBConnected: isConnected,
  createUser, findUserByEmail, findUserById, updateUser, matchPassword,
  createConversation, findConvsByUser, findConvById, updateConv, deleteConv, deleteAllConvs,
};
