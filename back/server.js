const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'front' directory
app.use(express.static(path.join(__dirname, '../front')));

// Default route - open app shell first
app.get('/', (req, res) => {
    res.redirect('/user/index.html');
});

app.get('/index.html', (req, res) => {
    res.redirect('/user/index.html');
});

// Friendly entry paths
app.get('/login', (req, res) => {
    res.redirect('/login.html');
});

app.get('/login/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

// Admin entry path
app.get('/admin.html', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/user', (req, res) => {
    res.redirect('/user/index.html');
});

// Server status check
app.get('/api/status', (req, res) => {
    res.json({ message: "SHAKTHI server is running!" });
});

// Start the server
module.exports = app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         🛡️  SHAKTHI SERVER STARTED  🛡️        ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐  App:    http://localhost:${PORT}            ║`);
    console.log(`║  👤  Login:  http://localhost:${PORT}/login.html  ║`);
    console.log(`║  🔧  Admin:  http://localhost:${PORT}/admin/login.html  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  All data flows through Firebase Firestore.');
    console.log('  This server only serves static files.');
    console.log('');
});
