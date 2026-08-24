const jwt  = require('jsonwebtoken');
const mem  = require('../utils/memoryStore');
let UserModel = null;
try { UserModel = require('../models/User'); } catch {}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required for auth middleware');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  const token = String(bearerToken || req.query.token || '').trim();
  if (!token) return res.status(401).json({ message: 'Not authorized. Missing token.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = mem.isDBConnected() && UserModel
      ? await UserModel.findById(decoded.id).select('-password')
      : await mem.findUserById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Token expired or invalid' });
  }
};

module.exports = { protect };
