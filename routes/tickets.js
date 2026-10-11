const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all tickets joined with projects, users, and message count
router.get('/', async (req, res) => {
  try {
    const tickets = await db.allAsync(`
      SELECT 
        t.*,
        p.title AS project_title,
        u.full_name AS client_name,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count
      FROM tickets t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.id DESC
    `);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single ticket with full message history and project title
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await db.getAsync(`
      SELECT t.*, p.title AS project_title, u.full_name AS client_name
      FROM tickets t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `, [id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const messages = await db.allAsync(
      'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC',
      [id]
    );

    res.json({ ...ticket, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new ticket linked to user_id and project_id
router.post('/', async (req, res) => {
  const { subject, description, priority, sender_name, project_id } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ error: 'Subject and description are required' });
  }

  try {
    const user = await db.getAsync('SELECT id, full_name FROM users LIMIT 1');
    const userId = user ? user.id : 1;
    const projId = project_id ? Number(project_id) : 1;
    const randomNum = Math.floor(100 + Math.random() * 900);
    const ticketNumber = `#TK-${randomNum}`;

    const result = await db.runAsync(
      `INSERT INTO tickets (user_id, project_id, ticket_number, subject, description, priority, status, last_response)
       VALUES (?, ?, ?, ?, ?, ?, 'Open', 'New request queued for engineering review')`,
      [userId, projId, ticketNumber, subject, description, priority || 'Normal Priority']
    );

    const ticketId = result.lastID;

    await db.runAsync(
      'INSERT INTO ticket_messages (ticket_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?)',
      [ticketId, sender_name || (user ? user.full_name : 'Sarah Jenkins'), 'CLIENT', description]
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [userId, `Ticket Created: ${ticketNumber}`, 'Support Portal', 'Just now', 'amber']
    );

    await db.runAsync(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [userId, 'Ticket Received', `Ticket ${ticketNumber} (${subject}) was registered.`]
    );

    const newTicket = await db.getAsync('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add reply message to a ticket thread
router.post('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { message, sender_name, sender_role } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const ticket = await db.getAsync('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const role = sender_role || 'CLIENT';
    const name = sender_name || (role === 'CLIENT' ? 'Sarah Jenkins' : 'Apex Support');

    await db.runAsync(
      'INSERT INTO ticket_messages (ticket_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?)',
      [id, name, role, message]
    );

    await db.runAsync(
      'UPDATE tickets SET last_response = ?, status = CASE WHEN status = "Resolved" THEN "In Progress" ELSE status END WHERE id = ?',
      [`Latest message from ${name}`, id]
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [ticket.user_id, `Reply on ${ticket.ticket_number}`, name, 'Just now', 'blue']
    );

    const messages = await db.allAsync('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC', [id]);
    res.json({ message: 'Reply sent', messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle or update status (Resolve / In Progress)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const ticket = await db.getAsync('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    await db.runAsync('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [ticket.user_id, `Ticket ${ticket.ticket_number} marked ${status}`, 'Support Desk', 'Just now', status === 'Resolved' ? 'emerald' : 'amber']
    );

    const updated = await db.getAsync('SELECT * FROM tickets WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
