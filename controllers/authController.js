const jwt = require('jsonwebtoken');
const mem = require('../utils/memoryStore');
let UserModel = null;
try { UserModel = require('../models/User'); } catch {}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const sign = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
const safe = (u) => ({ _id: u._id, name: u.name, email: u.email, avatar: u.avatar, theme: u.theme || 'dark', plan: u.plan || 'free' });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedName  = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');

    if (!normalizedName || !normalizedEmail || !normalizedPassword) return res.status(400).json({ message: 'All fields required' });
    if (normalizedName.length < 2)        return res.status(400).json({ message: 'Name too short' });
    if (!normalizedEmail.includes('@'))   return res.status(400).json({ message: 'Invalid email' });
    if (normalizedPassword.length < 6)     return res.status(400).json({ message: 'Password min 6 chars' });

    if (mem.isDBConnected() && UserModel) {
      const existingUser = await UserModel.findOne({ email: normalizedEmail });
      if (existingUser) return res.status(409).json({ message: 'Email already registered' });

      const user = await UserModel.create({ name: normalizedName, email: normalizedEmail, password: normalizedPassword });
      return res.status(201).json({ token: sign(user._id), user: safe(user) });
    }

    const existingUser = await mem.findUserByEmail(normalizedEmail);
    if (existingUser) return res.status(409).json({ message: 'Email already registered' });

    const user = await mem.createUser({ name: normalizedName, email: normalizedEmail, password: normalizedPassword });
    res.status(201).json({ token: sign(user._id), user: safe(user) });
  } catch (err) {
    if (err.code === 11000 && err.keyValue?.email) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');
    if (!normalizedEmail || !normalizedPassword) return res.status(400).json({ message: 'Email and password required' });

    if (mem.isDBConnected() && UserModel) {
      const user = await UserModel.findOne({ email: normalizedEmail }).select('+password');
      if (!user || !(await user.matchPassword(normalizedPassword))) return res.status(401).json({ message: 'Invalid credentials' });
      return res.json({ token: sign(user._id), user: safe(user) });
    }

    const user = await mem.findUserByEmail(normalizedEmail);
    if (!user || !(await mem.matchPassword(normalizedPassword, user.password))) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: sign(user._id), user: safe(user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMe = (req, res) => res.json({ user: safe(req.user) });

exports.updatePreferences = async (req, res) => {
  try {
    const { theme } = req.body;
    const updates = {};
    if (theme) updates.theme = theme;

    if (mem.isDBConnected() && UserModel) {
      const user = await UserModel.findByIdAndUpdate(req.user._id, updates, { new: true });
      return res.json({ user: safe(user) });
    }
    const user = await mem.updateUser(req.user._id, updates);
    res.json({ user: safe(user || req.user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
