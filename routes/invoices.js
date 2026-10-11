const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all invoices joined with projects and users
router.get('/', async (req, res) => {
  try {
    const invoices = await db.allAsync(`
      SELECT 
        i.*,
        p.title AS project_title,
        u.full_name AS client_name,
        u.company_name AS company_name
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN users u ON i.user_id = u.id
      ORDER BY i.id DESC
    `);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new invoice linked to user_id and project_id
router.post('/', async (req, res) => {
  const { period, amount, due_label, project_id } = req.body;
  if (!period || !amount) {
    return res.status(400).json({ error: 'Period and amount are required' });
  }

  try {
    const user = await db.getAsync('SELECT id FROM users LIMIT 1');
    const userId = user ? user.id : 1;
    const projId = project_id ? Number(project_id) : 1;
    const randomNum = Math.floor(10 + Math.random() * 90);
    const invoiceNumber = `#INV-2026-${randomNum}`;

    const result = await db.runAsync(
      'INSERT INTO invoices (user_id, project_id, invoice_number, period, amount, status, due_label) VALUES (?, ?, ?, ?, ?, "Pending", ?)',
      [userId, projId, invoiceNumber, period, parseFloat(amount), due_label || 'Due in 14 days']
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [userId, `Invoice Issued: ${invoiceNumber} ($${parseFloat(amount).toFixed(2)})`, 'Finance Team', 'Just now', 'indigo']
    );

    await db.runAsync(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [userId, 'New Invoice Ready', `${invoiceNumber} for $${parseFloat(amount).toFixed(2)} is pending payment.`]
    );

    const newInvoice = await db.getAsync('SELECT * FROM invoices WHERE id = ?', [result.lastID]);
    res.status(201).json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pay invoice endpoint
router.post('/:id/pay', async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await db.getAsync('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await db.runAsync(
      'UPDATE invoices SET status = "Paid", due_label = "Paid via Sandbox" WHERE id = ?',
      [id]
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [invoice.user_id, `Payment received for ${invoice.invoice_number}`, 'Billing Gateway', 'Just now', 'emerald']
    );

    await db.runAsync(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [invoice.user_id, 'Payment Confirmation', `Payment of $${invoice.amount.toFixed(2)} for ${invoice.invoice_number} was successfully recorded.`]
    );

    const updated = await db.getAsync('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ message: 'Payment processed successfully', invoice: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download receipt document with joined project and user info
router.get('/:id/receipt', async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await db.getAsync(`
      SELECT i.*, p.title AS project_title, u.full_name AS client_name, u.company_name AS company_name
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE i.id = ?
    `, [id]);
    if (!invoice) return res.status(404).send('Invoice not found');

    const receiptContent = `=============================================================
APEX DIGITAL SOLUTIONS — OFFICIAL PAYMENT RECEIPT
=============================================================
Invoice Number  : ${invoice.invoice_number}
Billed To       : ${invoice.company_name || 'Acme Global Ltd.'} (${invoice.client_name || 'Sarah Jenkins'})
Linked Project  : ${invoice.project_title || 'General Retainer'}
Billing Period  : ${invoice.period}
Amount          : $${parseFloat(invoice.amount).toFixed(2)} USD
Payment Status  : ${invoice.status.toUpperCase()}
Transaction ID  : TXN-${Date.now().toString(36).toUpperCase()}
Timestamp       : ${new Date().toISOString()}
=============================================================
Thank you for your business! Apex Digital Solutions.
=============================================================`;

    res.setHeader('Content-disposition', `attachment; filename=Receipt-${invoice.invoice_number}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.send(receiptContent);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
