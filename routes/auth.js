const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.getAsync('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, company: user.company_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        company_name: user.company_name,
        account_id: user.account_id,
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Current User Profile
router.get('/me', async (req, res) => {
  try {
    const user = await db.getAsync('SELECT id, email, full_name, role, company_name, account_id, avatar_url FROM users LIMIT 1');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile & Company Info in SQLite
router.patch('/profile', async (req, res) => {
  const { full_name, company_name, email } = req.body;

  try {
    const user = await db.getAsync('SELECT id FROM users LIMIT 1');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.runAsync(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name), 
           company_name = COALESCE(?, company_name), 
           email = COALESCE(?, email) 
       WHERE id = ?`,
      [full_name, company_name, email, user.id]
    );

    // Log Activity
    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [user.id, `Profile updated: ${company_name || full_name}`, 'Account Settings', 'Just now', 'indigo']
    );

    const updated = await db.getAsync('SELECT id, email, full_name, role, company_name, account_id, avatar_url FROM users WHERE id = ?', [user.id]);
    res.json({ message: 'Profile updated in database', user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Role (Admin vs Client) in SQLite
router.post('/switch-role', async (req, res) => {
  try {
    const user = await db.getAsync('SELECT id, role FROM users LIMIT 1');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newRole = user.role === 'CLIENT' ? 'ADMIN' : 'CLIENT';
    await db.runAsync('UPDATE users SET role = ? WHERE id = ?', [newRole, user.id]);

    const updated = await db.getAsync('SELECT id, email, full_name, role, company_name, account_id, avatar_url FROM users WHERE id = ?', [user.id]);
    res.json({ message: `Role switched to ${newRole}`, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
