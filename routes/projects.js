const express = require('express');
const router = express.Router();
const db = require('../db');

// List all projects with relational JOINs to users, documents, tickets, and invoices
router.get('/', async (req, res) => {
  try {
    const projects = await db.allAsync(`
      SELECT 
        p.*,
        u.full_name AS client_name,
        u.company_name AS company_name,
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) AS linked_docs_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id) AS linked_tickets_count,
        (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id) AS linked_invoices_count
      FROM projects p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
    `);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new project linked to active user
router.post('/', async (req, res) => {
  const { title, description, status, progress, due_date, lead_name } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const user = await db.getAsync('SELECT id FROM users LIMIT 1');
    const userId = user ? user.id : 1;

    const result = await db.runAsync(
      `INSERT INTO projects (user_id, title, description, status, progress, due_date, lead_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, description || '', status || 'In Progress', Number(progress) || 0, due_date || 'Q4 2026', lead_name || 'Engineering Lead']
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [userId, `New Project Created: ${title}`, lead_name || 'Project Manager', 'Just now', 'indigo']
    );

    await db.runAsync(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [userId, 'Project Kickoff', `Deliverable "${title}" was initiated.`]
    );

    const newProject = await db.getAsync('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project progress or status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, progress, title } = req.body;

  try {
    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await db.runAsync(
      `UPDATE projects 
       SET status = COALESCE(?, status), 
           progress = COALESCE(?, progress), 
           title = COALESCE(?, title) 
       WHERE id = ?`,
      [status, progress !== undefined ? Number(progress) : null, title, id]
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [existing.user_id, `Updated ${existing.title}: ${progress || existing.progress}% (${status || existing.status})`, 'System', 'Just now', 'emerald']
    );

    const updated = await db.getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [existing.user_id, `Project Archived: ${existing.title}`, 'Admin', 'Just now', 'slate']
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
