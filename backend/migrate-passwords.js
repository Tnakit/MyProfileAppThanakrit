// Run this ONCE after deploying the new server.js, then delete this file.
// It re-hashes any password in the `users` table that isn't already a bcrypt
// hash (bcrypt hashes always start with $2). Safe to run more than once.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function migrate() {
  const [users] = await db.query('SELECT id, username, password FROM users');
  let updated = 0;

  for (const user of users) {
    const looksHashed = typeof user.password === 'string' && user.password.startsWith('$2');
    if (looksHashed) continue;

    const hashed = await bcrypt.hash(user.password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
    updated++;
    console.log(`Hashed password for user: ${user.username}`);
  }

  console.log(`Done. ${updated} password(s) updated out of ${users.length} user(s).`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});