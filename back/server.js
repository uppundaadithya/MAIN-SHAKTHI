const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'front' directory
app.use(express.static(path.join(__dirname, '../front')));

// Default route - open app shell first
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Backward-compatible login path
app.get('/login.html', (req, res) => {
    res.redirect('/login/login.html');
});

// Admin entry path
app.get('/admin.html', (req, res) => {
    res.redirect('/admin/login.html');
});

// Server status check
app.get('/api/status', (req, res) => {
    res.json({ message: "SHAKTHI server is running!" });
});

// Start the server
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         🛡️  SHAKTHI SERVER STARTED  🛡️        ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐  App:    http://localhost:${PORT}            ║`);
    console.log(`║  👤  Login:  http://localhost:${PORT}/login/login.html  ║`);
    console.log(`║  🔧  Admin:  http://localhost:${PORT}/admin/login.html  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  All data flows through Firebase Firestore.');
    console.log('  This server only serves static files.');
    console.log('');
});
