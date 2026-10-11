const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// List all documents joined with projects and users
router.get('/', async (req, res) => {
  try {
    const documents = await db.allAsync(`
      SELECT 
        d.*,
        p.title AS project_title,
        u.full_name AS owner_name
      FROM documents d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.id DESC
    `);
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real File Upload linked to user_id and project_id
router.post('/upload', upload.single('file'), async (req, res) => {
  const category = req.body.category || 'General';
  const projectId = req.body.project_id ? Number(req.body.project_id) : 1;
  let fileName = req.body.name;
  let sizeLabel = '1.2 MB';
  let filePath = null;
  let fileUrl = '#';

  if (req.file) {
    fileName = fileName || req.file.originalname;
    sizeLabel = formatBytes(req.file.size);
    filePath = req.file.path;
    fileUrl = `/api/documents/download/file/${req.file.filename}`;
  } else if (!fileName) {
    return res.status(400).json({ error: 'File or document name is required' });
  }

  try {
    const user = await db.getAsync('SELECT id FROM users LIMIT 1');
    const userId = user ? user.id : 1;

    const result = await db.runAsync(
      'INSERT INTO documents (user_id, project_id, name, category, size_label, file_path, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, projectId, fileName, category, sizeLabel, filePath, fileUrl]
    );

    await db.runAsync(
      'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
      [userId, `File Vault Sync: ${fileName}`, 'Document Vault', 'Just now', 'blue']
    );

    await db.runAsync(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [userId, 'Document Added', `"${fileName}" is now available in your Document Vault.`]
    );

    const newDoc = await db.getAsync('SELECT * FROM documents WHERE id = ?', [result.lastID]);
    res.status(201).json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/file/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found on server.');
  }
});

router.get('/demo/:type', (req, res) => {
  const sampleContent = `====================================================\nAPEX DIGITAL SOLUTIONS — OFFICIAL SPECIFICATION DOCUMENT\nDocument Type: ${req.params.type.toUpperCase()}\nGenerated from SQLite Database\n====================================================\nThis is a verified document provided to Acme Global Ltd.`;
  res.setHeader('Content-disposition', `attachment; filename=Apex-${req.params.type}.txt`);
  res.setHeader('Content-type', 'text/plain');
  res.send(sampleContent);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await db.getAsync('SELECT * FROM documents WHERE id = ?', [id]);
    if (doc) {
      if (doc.file_path && fs.existsSync(doc.file_path)) {
        try { fs.unlinkSync(doc.file_path); } catch (e) {}
      }
      await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
      await db.runAsync(
        'INSERT INTO activities (user_id, title, author, time_label, color) VALUES (?, ?, ?, ?, ?)',
        [doc.user_id, `Document Deleted: ${doc.name}`, 'Document Vault', 'Just now', 'rose']
      );
    }
    res.json({ message: 'Document removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
