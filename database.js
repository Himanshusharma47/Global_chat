const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeSchema(); // Run schema update
    }
});

function initializeSchema() {
    db.serialize(() => {
        // 1. Users Table (Expanded)
        // We need to handle potential migrations if table exists, but for dev we'll just Ensure columns exist or CREATE
        // Ideally we would DROP for a full reset, but let's try to be gentle.
        // Actually, given the massive schema change (country, gender, etc), dropping is safest for a "clean slate" tutorial.
        // I will comment out the DROP in case they want to keep data, but real-world I'd run migrations.
        // For this user: Let's CREATE tables.
        
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            bio TEXT,
            profile_image TEXT DEFAULT 'default.png',
            country TEXT,
            city TEXT,
            gender TEXT,
            birthdate DATE,
            languages TEXT,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_online INTEGER DEFAULT 0
        )`);

        // 2. Friendships (New)
        db.run(`CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER,
            receiver_id INTEGER,
            status TEXT DEFAULT 'pending', -- pending, accepted, blocked
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(requester_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )`);

        // 3. Messages (New - Rich Chat)
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT,
            type TEXT DEFAULT 'text', -- text, image
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )`);

        // 4. Profile Views (To see who visited you)
        db.run(`CREATE TABLE IF NOT EXISTS profile_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viewer_id INTEGER,
            profile_id INTEGER,
            viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(viewer_id) REFERENCES users(id),
            FOREIGN KEY(profile_id) REFERENCES users(id)
        )`);
        
        // 5. Gallery (Keeping existing feature)
        db.run(`CREATE TABLE IF NOT EXISTS gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT,
            description TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 6. Comments / Wall
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )`);

        // 7. Private Messages (Chat)
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )`);

        // 7. Post Likes
        db.run(`CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER, -- FK to gallery.id
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES gallery(id),
            UNIQUE(user_id, post_id) -- One like per user per post
        )`);

        // 8. Post Comments
        db.run(`CREATE TABLE IF NOT EXISTS post_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES gallery(id)
        )`);

        console.log("Database Schema Initialized.");
    });
}

module.exports = db;
