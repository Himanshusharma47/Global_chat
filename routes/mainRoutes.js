const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');
const friendController = require('../controllers/friendController');
const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

router.get('/', (req, res) => {
    if (req.session.userId) res.redirect('/dashboard');
    else res.redirect('/login');
});

router.get('/dashboard', isAuthenticated, mainController.getDashboard);
// Profile & Interactions
router.get('/profile/:id', isAuthenticated, mainController.viewUserProfile);
router.get('/profile-views', mainController.getAllProfileViews);
router.get('/feed', isAuthenticated, mainController.getGlobalFeed); // Global Feed Route
router.post('/like/:id', isAuthenticated, mainController.likePost); // Like Post
router.post('/comment/:id', isAuthenticated, mainController.postComment); // Comment Post
router.post('/profile', upload.single('profile_image'), mainController.updateProfile);

// Search & Public Profile
router.get('/search', isAuthenticated, mainController.searchMembers);
// The line below is redundant with the new 'Profile & Interactions' block, but keeping it as per instruction's structure.
router.get('/profile/:id', isAuthenticated, mainController.viewUserProfile);

// Friend System
router.post('/friend/add', isAuthenticated, friendController.sendRequest);
router.post('/friend/accept', isAuthenticated, friendController.acceptRequest);

const messageController = require('../controllers/messageController');

// ... existing routes ...

// Comments
router.post('/comment', isAuthenticated, mainController.postComment);

// Messages (Chat)
router.get('/messages', isAuthenticated, messageController.getMessagesDashboard);
router.get('/messages/:id', isAuthenticated, messageController.getChatWithUser);
router.get('/chat/:id', isAuthenticated, (req, res) => res.redirect('/messages/' + req.params.id));

// Upload Gallery
router.post('/gallery', isAuthenticated, upload.single('image'), (req, res) => {
    // Moved logic to controller ideally, but keeping inline for speed or move to mainController
    // Let's rely on the previous inline logic or move it? 
    // For consistency, let's keep the logic we had in main.js but we are REPLACING main.js with this file.
    // I need to add the gallery handler to mainController if I want clean code.
    // For now, I will use a simple inline handler or add it to mainController in next step if missed.
    // Update: mainController didn't have uploadGallery. I will add it via inline here to avoid breaking content.
    const db = require('../database');
    if (req.file) {
        db.run(`INSERT INTO gallery (user_id, filename, description) VALUES (?, ?, ?)`, 
        [req.session.userId, req.file.filename, req.body.description], () => {
             res.redirect('/dashboard?tab=gallery');
        });
    } else {
        res.redirect('/dashboard?tab=gallery');
    }
});

module.exports = router;
