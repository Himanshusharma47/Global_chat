const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// GET /register
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// POST /register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    // Simple validation
    if (!name || !email || !password) {
        return res.render('register', { error: 'All fields are required' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
        db.run(sql, [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                   return res.render('register', { error: 'Email already exists' });
                }
                return res.render('register', { error: 'Error creating user' });
            }
            // Success -> Redirect to Login
            res.redirect('/login');
        });
    } catch (error) {
        res.render('register', { error: 'Server error' });
    }
});

// GET /login
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// POST /login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err || !user) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            // Set Session
            req.session.userId = user.id;
            req.session.userName = user.name;
            return res.redirect('/dashboard');
        } else {
            return res.render('login', { error: 'Invalid email or password' });
        }
    });
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;
