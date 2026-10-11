const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await db.allAsync('SELECT * FROM notifications ORDER BY id DESC LIMIT 10');
    const unreadCount = notifications.filter(n => n.is_read === 0).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.post('/mark-read', async (req, res) => {
  try {
    await db.runAsync('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
