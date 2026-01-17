const db = require('../database');

exports.sendRequest = (req, res) => {
    const requesterId = req.session.userId;
    const receiverId = req.body.receiver_id;

    if (requesterId == receiverId) return res.json({ success: false });

    // Check if exists
    db.get(`SELECT * FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)`, 
    [requesterId, receiverId, receiverId, requesterId], (err, row) => {
        if (row) return res.json({ success: false, message: 'Request already exists' });

        db.run(`INSERT INTO friendships (requester_id, receiver_id) VALUES (?, ?)`, [requesterId, receiverId], (err) => {
            if (err) return res.json({ success: false });
            req.session.success = 'Friend request sent!';
            res.redirect('/profile/' + receiverId); // Reload page
        });
    });
};

exports.acceptRequest = (req, res) => {
    const userId = req.session.userId;
    const requesterId = req.body.requester_id;

    db.run(`UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND receiver_id = ?`, [requesterId, userId], (err) => {
        res.redirect('/dashboard');
    });
};
