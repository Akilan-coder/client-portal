const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    // Explicitly enable SQLite Foreign Key enforcement
    db.run('PRAGMA foreign_keys = ON;');
  }
});

// Helper for promise-based queries
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

db.allAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

db.getAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize schema & migrations with full relational Foreign Keys
async function initDatabase() {
  db.serialize(async () => {
    db.run('PRAGMA foreign_keys = ON;');

    // 1. Users table (Parent table for Clients & Admins)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CLIENT',
        company_name TEXT NOT NULL,
        account_id TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Projects table (Linked to users)
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        lead_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Documents table (Linked to users AND projects)
    db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        size_label TEXT NOT NULL,
        file_path TEXT,
        file_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // 4. Tickets table (Linked to users AND projects)
    db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        ticket_number TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        last_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // 5. Ticket Messages (Linked to tickets with ON DELETE CASCADE)
    db.run(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);

    // 6. Invoices table (Linked to users AND projects)
    db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        invoice_number TEXT NOT NULL,
        period TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        due_label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // 7. Activity log (Linked to users)
    db.run(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        time_label TEXT NOT NULL,
        color TEXT DEFAULT 'indigo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 8. Notifications table (Linked to users)
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Safe migration for existing database files: add project_id if missing
    db.run(`ALTER TABLE documents ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`, () => {
      db.run(`UPDATE documents SET project_id = 1 WHERE project_id IS NULL`);
    });
    db.run(`ALTER TABLE tickets ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`, () => {
      db.run(`UPDATE tickets SET project_id = 1 WHERE project_id IS NULL`);
    });
    db.run(`ALTER TABLE invoices ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`, () => {
      db.run(`UPDATE invoices SET project_id = 1 WHERE project_id IS NULL`);
    });

    // Seed Initial User and related records if none exist
    db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
      if (err) return console.error('Error checking user count:', err);
      if (row.count === 0) {
        console.log('Database empty. Seeding initial relational dataset...');
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('client123', salt);

        db.run(
          `INSERT INTO users (email, password_hash, full_name, role, company_name, account_id, avatar_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            'sarah@acme.com',
            hashedPassword,
            'Sarah Jenkins',
            'CLIENT',
            'Acme Global Ltd.',
            '#ACME-8921',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'
          ],
          function (insertErr) {
            if (insertErr) return console.error('Error inserting seed user:', insertErr);
            const userId = this.lastID;

            // Seed Projects
            const stmtProj = db.prepare(
              'INSERT INTO projects (user_id, title, description, status, progress, due_date, lead_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            stmtProj.run(userId, 'E-Commerce Web Platform', 'Complete frontend rebuild using Next.js with high-performance payment processing.', 'In Progress', 75, 'Nov 15, 2026', 'David Clark');
            stmtProj.run(userId, 'Cloud Infrastructure Migration', 'Terraform scripts and Kubernetes cluster deployment on AWS us-east-1.', 'Client Review', 90, 'Oct 28, 2026', 'Priya Patel');
            stmtProj.run(userId, 'Brand Identity & Design System', 'Complete vector asset pack, typography standards, and interactive UI library in Figma.', 'Completed', 100, 'Delivered Sep 30', 'Elena Rostova');
            stmtProj.finalize();

            // Seed Documents linked to Projects (project_id: 1, 2, 3)
            const stmtDoc = db.prepare(
              'INSERT INTO documents (user_id, project_id, name, category, size_label, file_url) VALUES (?, ?, ?, ?, ?, ?)'
            );
            stmtDoc.run(userId, 1, 'Master Services Agreement (MSA) - Signed.pdf', 'Legal', '2.4 MB', '/api/documents/demo/msa');
            stmtDoc.run(userId, 2, 'API Architecture & Security Specs v2.0.pdf', 'Technical', '4.1 MB', '/api/documents/demo/api');
            stmtDoc.run(userId, 3, 'Brand Design Guidelines & Assets (ZIP).zip', 'Design', '48.2 MB', '/api/documents/demo/design');
            stmtDoc.finalize();

            // Seed Tickets linked to Projects
            db.run(
              `INSERT INTO tickets (user_id, project_id, ticket_number, subject, description, priority, status, last_response)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [userId, 1, '#TK-402', 'Production Webhook latency inquiry', 'Investigating the Redis queue latency on the staging endpoint.', 'High Priority', 'In Progress', 'Under review by Lead Engineer'],
              function (ticketErr) {
                if (!ticketErr) {
                  const ticketId = this.lastID;
                  const stmtMsg = db.prepare('INSERT INTO ticket_messages (ticket_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?)');
                  stmtMsg.run(ticketId, 'Sarah Jenkins', 'CLIENT', 'Hi Team, we noticed webhook delays of up to 450ms on our checkout hook.');
                  stmtMsg.run(ticketId, 'Lead Dev (David)', 'SUPPORT', 'Hello Sarah, we are profiling the Redis queue worker latency right now.');
                  stmtMsg.finalize();
                }
              }
            );

            db.run(
              `INSERT INTO tickets (user_id, project_id, ticket_number, subject, description, priority, status, last_response)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [userId, 2, '#TK-398', 'Add 2 additional seats for Acme QA Team', 'Credentials and invitation links sent to both QA analysts.', 'Normal Priority', 'Resolved', 'Closed on Oct 04, 2026'],
              function (ticketErr) {
                if (!ticketErr) {
                  const ticketId = this.lastID;
                  const stmtMsg = db.prepare('INSERT INTO ticket_messages (ticket_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?)');
                  stmtMsg.run(ticketId, 'Sarah Jenkins', 'CLIENT', 'Can you please provision access for our two QA leads?');
                  stmtMsg.run(ticketId, 'Admin Support', 'SUPPORT', 'Both accounts have been provisioned and login credentials emailed.');
                  stmtMsg.finalize();
                }
              }
            );

            // Seed Invoices linked to Projects
            const stmtInv = db.prepare(
              'INSERT INTO invoices (user_id, project_id, invoice_number, period, amount, status, due_label) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            stmtInv.run(userId, 1, '#INV-2026-08', 'October 2026 (Sprint 4 Milestones)', 4850.00, 'Pending', 'Due in 5 Days');
            stmtInv.run(userId, 3, '#INV-2026-07', 'September 2026 (Design Phase)', 6200.00, 'Paid', 'Paid on Oct 01');
            stmtInv.finalize();

            // Seed Activities
            const stmtAct = db.prepare(
              'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)'
            );
            stmtAct.run(userId, 'Sprint 4 Milestones Approved', 'Marcus Vance', '2 hours ago', 'emerald');
            stmtAct.run(userId, 'Uploaded API Contract v2.1', 'Document Vault', 'Yesterday', 'blue');
            stmtAct.run(userId, 'Invoice #INV-2026-08 Generated', 'Billing Department', '3 days ago', 'indigo');
            stmtAct.finalize();

            // Seed Notifications
            const stmtNotif = db.prepare(
              'INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, ?)'
            );
            stmtNotif.run(userId, 'Sprint Milestone Update', 'David Clark pushed Sprint 4 deliverable updates.', 0);
            stmtNotif.run(userId, 'Invoice Generated', 'Invoice #INV-2026-08 ($4,850.00) is ready for review.', 0);
            stmtNotif.finalize();

            console.log('Seed database ready with all relational connections.');
          }
        );
      }
    });
  });
}

initDatabase();

module.exports = db;
