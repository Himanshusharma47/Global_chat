const db = require('../database');

// GET /messages (No specific user selected)
exports.getMessagesDashboard = (req, res) => {
    const userId = req.session.userId;

    // Fetch all friends for the sidebar - Ordered by recent activity
    const sql = `
        SELECT u.id, u.name, u.profile_image, u.is_online,
        (SELECT MAX(created_at) FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)) as last_msg_time,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM friendships f
        JOIN users u ON (f.requester_id = u.id OR f.receiver_id = u.id)
        WHERE (f.requester_id = ? OR f.receiver_id = ?) 
        AND f.status = 'accepted'
        AND u.id != ?
        ORDER BY last_msg_time DESC, u.is_online DESC, u.name ASC
    `;

    db.all(sql, [userId, userId, userId, userId, userId, userId], (err, friends) => {
        if (err) {
            console.error(err);
            return res.render('dashboard', { user: req.session.userName, error: 'Error fetching friends' });
        }

        res.render('chat', {
            user: req.session.userName,
            userData: req.session, // careful passing session, but need ID
            friends: friends || [],
            currentChatUser: null,
            messages: [],
            activeTab: 'messages'
        });
    });
};

// GET /messages/:id (Chatting with specific user)
exports.getChatWithUser = (req, res) => {
    const userId = req.session.userId;
    const targetUserId = req.params.id;

    if (userId == targetUserId) return res.redirect('/messages');

    // 1. Fetch Friends (Sidebar) - Ordered by most recent message (sent or received)
    // We want friends where we have an accepted friendship.
    // AND we want to prioritize friends who I have chatted with most recently.
    const sqlFriends = `
        SELECT u.id, u.name, u.profile_image, u.is_online,
        (SELECT MAX(created_at) FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)) as last_msg_time,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM friendships f
        JOIN users u ON (f.requester_id = u.id OR f.receiver_id = u.id)
        WHERE (f.requester_id = ? OR f.receiver_id = ?) 
        AND f.status = 'accepted'
        AND u.id != ?
        ORDER BY last_msg_time DESC, u.is_online DESC, u.name ASC
    `;

    db.all(sqlFriends, [userId, userId, userId, userId, userId, userId], (err, friends) => {
        if (err) return res.redirect('/dashboard');

        // 2. Fetch Target User Details
        db.get(`SELECT id, name, profile_image, is_online FROM users WHERE id = ?`, [targetUserId], (err, targetUser) => {
            if (err || !targetUser) return res.redirect('/messages');

            // 3. Mark Messages as Read (from target to me)
            db.run(`UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?`, [targetUserId, userId]);

            // 4. Fetch Message History
            const sqlMessages = `
                SELECT * FROM messages 
                WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?) 
                ORDER BY created_at ASC
            `;

            db.all(sqlMessages, [userId, targetUserId, targetUserId, userId], (err, messages) => {
                res.render('chat', {
                    user: req.session.userName,
                    userId: userId, // Pass ID for client-side logic
                    friends: friends || [],
                    currentChatUser: targetUser,
                    messages: messages || [],
                    activeTab: 'messages'
                });
            });
        });
    });
};
