const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http'); // Required for Socket.io
const socketIo = require('socket.io');
const db = require('./database');

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server); // Attach Socket.io

const PORT = process.env.PORT || 3000;

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
    secret: 'globalconnect_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Global Variables for Views (e.g. user checks)
app.use((req, res, next) => {
    // Make countries available globally
    res.locals.countries = require('./utils/countries');

    // Flash Messages Middleware
    res.locals.success = req.session.success || null;
    res.locals.error = req.session.error || null;
    delete req.session.success;
    delete req.session.error;

    res.locals.user = req.session.userName || null;
    res.locals.userId = req.session.userId || null;
    
    if (req.session.userId) {
        db.get(`SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0`, [req.session.userId], (err, row) => {
            res.locals.unreadCount = row ? row.count : 0;
            
            // Expose Date Helper
            const { formatLastSeen } = require('./utils/dateFormatter');
            res.locals.formatLastSeen = formatLastSeen;
            
            next();
        });
    } else {
        res.locals.unreadCount = 0;
        // Expose Date Helper (even if logged out, though less likely needed)
        const { formatLastSeen } = require('./utils/dateFormatter');
        res.locals.formatLastSeen = formatLastSeen;
        next();
    }
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const mainRoutes = require('./routes/mainRoutes');

app.use('/', authRoutes);
app.use('/', mainRoutes);

// Socket.io Logic (Real-Time Engine)
// Socket.io Logic (Real-Time Engine)
// Map socket ID to User ID for disconnect handling
const socketUserMap = new Map();

io.on('connection', (socket) => {
    console.log('New client connected: ' + socket.id);

    // Join Chat Room
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Handle User Online Status
    socket.on('register_user', (userId) => {
        if (!userId) return;
        
        socketUserMap.set(socket.id, userId);
        
        // Update DB: Online
        db.run(`UPDATE users SET is_online = 1, last_active = CURRENT_TIMESTAMP WHERE id = ?`, [userId], (err) => {
            if (!err) {
                io.emit('user_status', { userId: userId, status: 'online' });
            }
        });
    });

    // Handle Chat Message
    socket.on('send_message', (data) => {
        const { room, sender_id, receiver_id, content } = data;
        console.log(`Message in ${room}: ${content}`);

        // Save to Database
        const sql = `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`;
        db.run(sql, [sender_id, receiver_id, content], (err) => {
            if (err) return console.error('DB Error:', err.message);
            
            // Broadcast to everyone in the room (including sender)
            io.to(room).emit('receive_message', data);
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected: ' + socket.id);
        const userId = socketUserMap.get(socket.id);
        
        if (userId) {
            // Update DB: Offline
            const now = new Date(); // Javascript Date for last_active
            // Note: SQLite CURRENT_TIMESTAMP is UTC. 
            // Better to update is_online=0 and let DB handle timestamp or pass it.
            // Using CURRENT_TIMESTAMP for consistent DB time.
            
            db.run(`UPDATE users SET is_online = 0, last_active = CURRENT_TIMESTAMP WHERE id = ?`, [userId], (err) => {
                if (!err) {
                    // We need to fetch the updated timestamp or generate one to send to client
                    // For simplicity, we send the server's current time formatted
                    // But to respect DRY, we send the raw timestamp or let client refetch?
                    // Better: Send the event, let client calculate or use the formatted string if we computed it.
                    // Actually, the requirement is "Last seen just now" immediately.
                    
                    const { formatLastSeen } = require('./utils/dateFormatter');
                    const statusText = formatLastSeen(new Date(), false); // Just now
                    
                    io.emit('user_status', { 
                        userId: userId, 
                        status: 'offline', 
                        lastActive: statusText,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            socketUserMap.delete(socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Global Connect Server running on http://localhost:${PORT}`);
});
