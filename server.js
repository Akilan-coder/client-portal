require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Helper to get Local Network IPv4 Address for Wi-Fi sharing
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Smart route loader: works whether files are in ./routes/name.js OR ./name.js (root)
function loadRoute(routeName) {
  const nestedPath = path.join(__dirname, 'routes', `${routeName}.js`);
  const rootPath = path.join(__dirname, `${routeName}.js`);
  if (fs.existsSync(nestedPath)) {
    return require(nestedPath);
  } else if (fs.existsSync(rootPath)) {
    return require(rootPath);
  } else {
    throw new Error(`Route file for "${routeName}" not found in ./routes/ or root folder.`);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files and uploaded files
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register API Routes
app.use('/api/auth', loadRoute('auth'));
app.use('/api/dashboard', loadRoute('dashboard'));
app.use('/api/projects', loadRoute('projects'));
app.use('/api/documents', loadRoute('documents'));
app.use('/api/tickets', loadRoute('tickets'));
app.use('/api/invoices', loadRoute('invoices'));
app.use('/api/notifications', loadRoute('notifications'));

// Health & Network Info check endpoint
app.get('/api/health', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: 'SQLite Connected',
    service: 'Apex Client Portal API',
    localUrl: `http://localhost:${PORT}`,
    networkUrl: `http://${localIp}:${PORT}`
  });
});

// Root route falls back to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start listening on 0.0.0.0 so other devices on the network, Render, or tunnels can connect
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`====================================================`);
  console.log(`🚀 Client Portal Backend Server running on port ${PORT}`);
  console.log(`💻 Local Access   : http://localhost:${PORT}`);
  console.log(`📱 Network Share  : http://${localIp}:${PORT}`);
  console.log(`🌍 Public Tunnel  : Run "npm run share" in a 2nd terminal`);
  console.log(`====================================================`);
});
