const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app            = require('./app');
const { connectDB }  = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB();

const server = app.listen(PORT, () => {
  console.log(`\n🧠 GyaanAI v3 Server → http://localhost:${PORT}`);
  console.log(`   AI Provider : ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health      : http://localhost:${PORT}/health\n`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('unhandledRejection', (err) => { console.error('Unhandled Rejection:', err.message); });

module.exports = server;
