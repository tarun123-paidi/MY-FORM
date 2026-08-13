const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));

// Helper: Read DB
function readDB() {
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading db.json:', err);
        return { config: { adminPin: "1234" }, eggs: [], chicks: [], orders: [] };
    }
}

// Helper: Write DB
function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing db.json:', err);
        return false;
    }
}

// Helper: Get Sanitize Config for Public (removes sensitive adminPin)
function getPublicConfig(config) {
    const safe = { ...config };
    delete safe.adminPin;
    return safe;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// GET /api/health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'my farms vizinagaram REST API is running successfully' });
});

// GET /api/config - Public Config
app.get('/api/config', (req, res) => {
    const db = readDB();
    res.json({ success: true, data: getPublicConfig(db.config) });
});

// POST /api/admin/login - Authenticate Admin PIN
app.post('/api/admin/login', (req, res) => {
    const { pin } = req.body;
    const db = readDB();
    const currentPin = db.config.adminPin || "1234";

    if (pin && String(pin).trim() === String(currentPin).trim()) {
        res.json({
            success: true,
            message: 'Admin Authentication Successful!',
            token: 'admin-auth-granted-' + Date.now()
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid Admin PIN! Access Denied.'
        });
    }
});

// POST /api/config - Update farm configuration (ADMIN PROTECTED)
app.post('/api/config', (req, res) => {
    const db = readDB();
    const { adminPin, ...newConfig } = req.body;
    const requestPin = adminPin || req.headers['x-admin-pin'];
    const currentPin = db.config.adminPin || "1234";

    // Verify Admin Authorization PIN
    if (!requestPin || String(requestPin).trim() !== String(currentPin).trim()) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or missing Admin PIN.'
        });
    }

    if (!newConfig.farmName) {
        return res.status(400).json({ success: false, error: 'Farm Name is required' });
    }

    // Preserve or update adminPin if provided
    const updatedPin = newConfig.newAdminPin ? newConfig.newAdminPin.trim() : currentPin;
    delete newConfig.newAdminPin;

    db.config = {
        ...db.config,
        ...newConfig,
        adminPin: updatedPin
    };

    if (writeDB(db)) {
        res.json({
            success: true,
            message: 'Farm config updated successfully by Administrator!',
            data: getPublicConfig(db.config)
        });
    } else {
        res.status(500).json({ success: false, error: 'Failed to write config to database' });
    }
});

// GET /api/products/eggs - Fetch egg catalog
app.get('/api/products/eggs', (req, res) => {
    const db = readDB();
    const category = req.query.category;
    let eggs = db.eggs || [];

    if (category && category !== 'all') {
        eggs = eggs.filter(e => e.category === category);
    }

    res.json({ success: true, count: eggs.length, data: eggs });
});

// GET /api/products/chicks - Fetch chick catalog
app.get('/api/products/chicks', (req, res) => {
    const db = readDB();
    const ageGroup = req.query.ageGroup;
    let chicks = db.chicks || [];

    if (ageGroup && ageGroup !== 'all') {
        chicks = chicks.filter(c => c.ageGroup === ageGroup);
    }

    res.json({ success: true, count: chicks.length, data: chicks });
});

// GET /api/products - Fetch all products
app.get('/api/products', (req, res) => {
    const db = readDB();
    res.json({
        success: true,
        eggs: db.eggs || [],
        chicks: db.chicks || []
    });
});

// POST /api/orders - Record new customer order/inquiry
app.post('/api/orders', (req, res) => {
    const db = readDB();
    const { name, phone, category, message, totalAmount, quantity } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ success: false, error: 'Name and Phone number are required' });
    }

    const newOrder = {
        id: 'ORD-' + Date.now(),
        createdAt: new Date().toISOString(),
        name,
        phone,
        category: category || 'General Inquiry',
        quantity: quantity || 1,
        totalAmount: totalAmount || 0,
        message: message || '',
        status: 'Pending'
    };

    if (!db.orders) db.orders = [];
    db.orders.unshift(newOrder);

    if (writeDB(db)) {
        res.status(201).json({
            success: true,
            message: 'Order received and recorded in backend database!',
            order: newOrder
        });
    } else {
        res.status(500).json({ success: false, error: 'Failed to record order' });
    }
});

// GET /api/orders - Fetch saved customer orders (ADMIN ONLY)
app.get('/api/orders', (req, res) => {
    const requestPin = req.headers['x-admin-pin'] || req.query.pin;
    const db = readDB();
    const currentPin = db.config.adminPin || "1234";

    if (!requestPin || String(requestPin).trim() !== String(currentPin).trim()) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin PIN required to view orders' });
    }

    res.json({ success: true, count: (db.orders || []).length, data: db.orders || [] });
});

// Catch-all route to serve SPA frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 my farms.vzx Backend API Server running on port ${PORT}`);
    console.log(`🔑 Admin Protection Enabled (Default PIN: 1234)`);
    console.log(`====================================================`);
});
