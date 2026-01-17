const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// GET /dashboard
router.get('/dashboard', isAuthenticated, (req, res) => {
    // We need to fetch User Data, Notes, and Gallery for the dashboard
    const userId = req.session.userId;
    
    // Using Promises to fetch all data in parallel (conceptually)
    // 1. Get User Details
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.send('Error fetching user');

        // 2. Get Notes (Sent by user OR Sent TO user)
        // Simple Logic: Show notes created by me for now, or sent to my email
        const userEmail = user.email;
        db.all(`SELECT * FROM notes WHERE sender_id = ? OR recipient_email = ? ORDER BY created_at DESC`, [userId, userEmail], (err, notes) => {
            if (err) return res.send('Error fetching notes');

            // 3. Get Gallery
            db.all(`SELECT * FROM gallery WHERE user_id = ? ORDER BY uploaded_at DESC`, [userId], (err, gallery) => {
                if (err) return res.send('Error fetching gallery');

                // Render Dashboard with all data
                res.render('dashboard', { 
                    user: user.name,
                    userData: user,
                    notes: notes || [],
                    gallery: gallery || [],
                    activeTab: req.query.tab || 'profile' // Allow switching via query param
                });
            });
        });
    });
});

// POST /profile - Update Profile
router.post('/profile', isAuthenticated, upload.single('profile_image'), (req, res) => {
    const { bio } = req.body;
    const userId = req.session.userId;
    
    let sql = `UPDATE users SET bio = ? WHERE id = ?`;
    let params = [bio, userId];

    if (req.file) {
        const filename = req.file.filename;
        sql = `UPDATE users SET bio = ?, profile_image = ? WHERE id = ?`;
        params = [bio, filename, userId];
    }

    db.run(sql, params, (err) => {
        if (err) console.error(err);
        res.redirect('/dashboard?tab=profile');
    });
});

// POST /notes - Create Note
router.post('/notes', isAuthenticated, (req, res) => {
    const { content, recipient_email } = req.body;
    const senderId = req.session.userId;

    const sql = `INSERT INTO notes (sender_id, recipient_email, content) VALUES (?, ?, ?)`;
    db.run(sql, [senderId, recipient_email, content], (err) => {
        if (err) console.error(err);
        res.redirect('/dashboard?tab=notes');
    });
});

// POST /gallery - Upload Image
router.post('/gallery', isAuthenticated, upload.single('image'), (req, res) => {
    const { description } = req.body;
    const userId = req.session.userId;
    
    if (req.file) {
        const filename = req.file.filename;
        const sql = `INSERT INTO gallery (user_id, filename, description) VALUES (?, ?, ?)`;
        db.run(sql, [userId, filename, description], (err) => {
            if (err) console.error(err);
            res.redirect('/dashboard?tab=gallery');
        });
    } else {
        res.redirect('/dashboard?tab=gallery');
    }
});

module.exports = router;
