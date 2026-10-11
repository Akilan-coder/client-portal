const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/stats', async (req, res) => {
  try {
    const projects = await db.allAsync('SELECT * FROM projects');
    const documents = await db.allAsync('SELECT * FROM documents');
    const tickets = await db.allAsync('SELECT * FROM tickets WHERE status != "Resolved"');
    const pendingInvoices = await db.allAsync('SELECT * FROM invoices WHERE status = "Pending"');
    const activities = await db.allAsync('SELECT * FROM activities ORDER BY id DESC LIMIT 6');

    const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // Calculate dynamic sprint points from project progress
    const totalProgress = projects.reduce((sum, p) => sum + (p.progress || 0), 0);
    const avgProgress = projects.length > 0 ? Math.round(totalProgress / projects.length) : 50;

    const stats = {
      activeProjectsCount: projects.filter(p => p.status !== 'Completed').length,
      totalProjectsCount: projects.length,
      documentsCount: documents.length,
      openTicketsCount: tickets.length,
      pendingInvoicesAmount: totalPendingAmount,
      recentActivities: activities,
      velocity: {
        labels: ['Sprint 1 (Kickoff)', 'Sprint 2 (Architecture)', 'Sprint 3 (Core APIs)', 'Sprint 4 (Active Cycle)'],
        delivered: [35, 42, 48, Math.max(30, Math.round(avgProgress * 0.7))],
        planned: [35, 40, 45, 55]
      }
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
  }
});

module.exports = router;
