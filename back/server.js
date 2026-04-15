const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'front' directory 
// (This allows the server to find your images/css/js)
app.use(express.static(path.join(__dirname, '../front')));

// Basic Route
app.get('/api/status', (req, res) => {
    res.json({ message: "Server is running smoothly!" });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is sprinting at http://localhost:${PORT}`);
});