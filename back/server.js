const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
// Vercel provides the PORT automatically
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * IMPORTANT: In Vercel, static files are best handled by Vercel itself.
 * However, to keep your logic, we use absolute paths.
 * This assumes 'front' and 'back' are siblings in your project root.
 */
app.use(express.static(path.join(__dirname, '../front')));

// Default route - open app shell first
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/index.html', (req, res) => {
    res.redirect('/user/index.html');
});

// Friendly entry paths
app.get('/admin/login', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/login.html', (req, res) => {
    res.redirect('/login/login.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/user', (req, res) => {
    res.redirect('/user/index.html');
});

// Server status check
app.get('/api/status', (req, res) => {
    res.json({
        status: "online",
        message: "SHAKTHI server is running on Vercel!",
        timestamp: new Date()
    });
});

// SOS endpoint - sends alert location
// Frontend expects: POST /api/send-sos with { lat, lon }
app.post('/api/send-sos', async (req, res) => {
    try {
        const { lat, lon } = req.body || {};

        // Alert is processed through Firebase
        res.status(200).json({
            success: true,
            location: { lat: lat ?? null, lon: lon ?? null }
        });
    } catch (err) {
        res.status(500).json({
            error: err?.message || 'Unknown error'
        });
    }
});


/**
 * START LOGIC
 * On Vercel, we export the app. 
 * For local development, we call app.listen().
 */
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🛡️ SHAKTHI Local Server: http://localhost:${PORT}`);
    });
}

// THIS IS REQUIRED FOR VERCEL
module.exports = app;