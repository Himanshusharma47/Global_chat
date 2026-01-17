const db = require('../database');
const User = require('../models/User');

exports.getDashboard = (req, res) => {
    const userId = req.session.userId;

    User.findById(userId, (err, user) => {
        if (err || !user) return res.redirect('/login');

        // 1. Fetch Random Members for "Discover" (Center Column)
        db.all(`SELECT id, name, country, city, profile_image, birthdate FROM users WHERE id != ? ORDER BY RANDOM() LIMIT 12`, [userId], (err, randomMembers) => {

            // 2. Fetch recent Profile Views (Unique per user)
            db.all(`SELECT u.id, u.name, u.profile_image, u.city, u.country, MAX(v.viewed_at) as viewed_at, COUNT(*) as view_count
                    FROM profile_views v 
                    JOIN users u ON v.viewer_id = u.id 
                    WHERE v.profile_id = ? 
                    GROUP BY v.viewer_id
                    ORDER BY viewed_at DESC LIMIT 6`, [userId], (err, views) => {
                
                // 3. Fetch Gallery (for the dashboard tab)
                db.all(`SELECT * FROM gallery WHERE user_id = ? ORDER BY uploaded_at DESC`, [userId], (err, gallery) => {

                    // 4. Fetch Pending Friend Requests
                    db.all(`SELECT f.requester_id, u.name, u.profile_image, f.created_at 
                            FROM friendships f 
                            JOIN users u ON f.requester_id = u.id 
                            WHERE f.receiver_id = ? AND f.status = 'pending'`, [userId], (err, requests) => {

                        // 5. Fetch My Wall Comments
                        db.all(`SELECT c.*, u.name as sender_name, u.profile_image as sender_image, u.id as sender_id 
                                FROM comments c 
                                JOIN users u ON c.sender_id = u.id 
                                WHERE c.receiver_id = ? 
                                ORDER BY c.created_at DESC`, [userId], (err, comments) => {
                            
                            // 6. Fetch View Counts (Today)
                            db.get(`SELECT COUNT(*) as count FROM profile_views WHERE profile_id = ? AND date(viewed_at) = date('now', 'localtime')`, [userId], (err, row) => {
                                const viewsToday = row ? row.count : 0;

                                res.render('dashboard', {
                                    user: user.name,
                                    userData: user,
                                    randomMembers: randomMembers || [], // Randomized list
                                    profileViews: views || [],
                                    viewsToday: viewsToday,
                                    galleryData: gallery || [],
                                    friendRequests: requests || [],
                                    wallComments: comments || [],
                                    activeTab: req.query.tab || 'home'
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};

// Global Feed (Explore)
exports.getGlobalFeed = (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const viewerId = req.session.userId;

    const sql = `
        SELECT g.id, g.user_id as author_id, g.filename, g.description, g.uploaded_at,
        u.username, u.name, u.profile_image, u.country,
        (SELECT status FROM friendships f 
         WHERE (f.requester_id = ? AND f.receiver_id = g.user_id) 
            OR (f.requester_id = g.user_id AND f.receiver_id = ?)
        ) as friendship_status,
        (SELECT requester_id FROM friendships f 
         WHERE (f.requester_id = ? AND f.receiver_id = g.user_id) 
            OR (f.requester_id = g.user_id AND f.receiver_id = ?)
        ) as friendship_requester,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = g.id) as like_count,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = g.id) as comment_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = g.id AND l.user_id = ?) as user_liked
        FROM gallery g
        JOIN users u ON g.user_id = u.id
        ORDER BY g.uploaded_at DESC
        LIMIT 50
    `;

    db.all(sql, [viewerId, viewerId, viewerId, viewerId, viewerId], (err, posts) => {
        if (err) {
            console.error(err);
            return res.render('feed', { posts: [] });
        }

        if (posts.length === 0) {
            return res.render('feed', { posts: [], user: req.session.userName, userId: viewerId });
        }

        const postIds = posts.map(p => p.id);
        const placeholders = postIds.map(() => '?').join(',');

        const commentSql = `
            SELECT c.*, u.username, u.name, u.profile_image 
            FROM post_comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.post_id IN (${placeholders}) 
            ORDER BY c.created_at ASC
        `;

        db.all(commentSql, postIds, (err, comments) => {
            if (err) {
                console.error('Error fetching comments:', err);
                // Render posts without comments if comments fail
                return res.render('feed', { posts: posts, user: req.session.userName, userId: viewerId });
            }

            // Map comments to posts
            posts.forEach(p => {
                p.comments = comments.filter(c => c.post_id === p.id);
            });

            if (posts.length > 0) {
                console.log('--- DEBUG FEED POST [0] ---');
                console.log(JSON.stringify(posts[0], null, 2));
                console.log('---------------------------');
            }

            res.render('feed', { posts: posts, user: req.session.userName, userId: viewerId, activeTab: 'feed' });
        });
    });
};

// Like Post
exports.likePost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const postId = req.params.id;
    const userId = req.session.userId;

    // Check if already liked
    db.get(`SELECT id FROM likes WHERE user_id = ? AND post_id = ?`, [userId, postId], (err, row) => {
        if (row) {
            // Unlike
            db.run(`DELETE FROM likes WHERE user_id = ? AND post_id = ?`, [userId, postId], (err) => {
                if (err) return res.json({ success: false });
                res.json({ success: true, liked: false });
            });
        } else {
            // Like
            db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [userId, postId], (err) => {
                if (err) return res.json({ success: false });
                
                // NOTIFICATION LOGIC HERE (socket emit)
                // Need to fetch post owner to notify
                db.get(`SELECT user_id FROM gallery WHERE id = ?`, [postId], (err, post) => {
                     if (post && post.user_id != userId) {
                         // We will emit this event in server.js or just insert into a notifications table if we had one.
                         // For now, just return success. real-time can be done if we pass 'io' instance or similar.
                     }
                });

                res.json({ success: true, liked: true });
            });
        }
    });
};

// Add Comment
exports.postComment = (req, res) => {
    console.log('--- Post Comment Debug ---');
    console.log('Session:', req.session);
    console.log('User ID:', req.session.userId);
    console.log('Post ID:', req.params.id);
    console.log('Body:', req.body);

    if (!req.session.userId) {
        console.log('Error: User not logged in.');
        return res.redirect('/login');
    }
    
    const postId = req.params.id;
    const content = req.body.content;
    const userId = req.session.userId;

    if (!content) {
        console.log('Error: Empty comment content.');
        return res.redirect('/feed');
    }

    db.run(`INSERT INTO post_comments (user_id, post_id, content) VALUES (?, ?, ?)`, [userId, postId, content], (err) => {
        if (err) {
            console.error('Database Error inserting comment:', err);
            return res.redirect('/feed');
        }
        console.log('Comment inserted successfully.');
        res.redirect('/feed'); // Simple refresh for now
    });
};

exports.updateProfile = (req, res) => {
    const userId = req.session.userId;
    const { name, bio, country, city } = req.body;
    let data = { name, bio, country, city };

    if (req.file) {
        data.profile_image = req.file.filename;
    }

    User.updateProfile(userId, data, (err) => {
        if (err) {
            console.error(err);
            req.session.error = 'Failed to update profile.';
        } else {
            if (name) req.session.userName = name; // Sync session
            req.session.success = 'Profile updated successfully!';
        }
        res.redirect('/dashboard?tab=profile');
    });
};

// Search Members Logic (Advanced)
exports.searchMembers = (req, res) => {
    const { gender, country, min_age, max_age, username } = req.query;
    const currentUserId = req.session.userId;

    let sql = `SELECT * FROM users WHERE id != ?`;
    let params = [currentUserId];

    if (username && username !== '') {
        // If searching by username, prioritize exact or partial match
        // Note: Resetting previous query parts to just search by username might be better, OR combined
        // Let's do partial match for better UX
        sql += ` AND username LIKE ?`;
        params.push(`%${username}%`);
    }

    if (gender && gender !== '') {
        sql += ` AND gender = ?`;
        params.push(gender);
    }
    if (country && country !== '') {
        sql += ` AND country = ?`;
        params.push(country);
    }
    
    // Hard limit
    sql += ` LIMIT 50`;

    db.all(sql, params, (err, users) => {
        res.render('search_results', { users: users || [], user: req.session.userName, query: req.query, activeTab: 'search' });
    });
};

// View Public Profile
exports.viewUserProfile = (req, res) => {
    const targetId = req.params.id;
    const viewerId = req.session.userId;

    if (targetId == viewerId) return res.redirect('/dashboard?tab=profile');

    User.findById(targetId, (err, targetUser) => {
        if (err || !targetUser) return res.send('User not found');

        // Log Profile View
        db.run(`INSERT INTO profile_views (viewer_id, profile_id) VALUES (?, ?)`, [viewerId, targetId]);

        // Check Friendship Status
        db.get(`SELECT status, requester_id FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)`, 
        [viewerId, targetId, targetId, viewerId], (err, friendship) => {
            
            let sentiment = 'none'; 
            if (friendship) {
                if (friendship.status === 'accepted') sentiment = 'friends';
                else if (friendship.requester_id == viewerId) sentiment = 'pending_sent';
                else sentiment = 'pending_received';
            }

            // Get User's Gallery
            db.all(`SELECT * FROM gallery WHERE user_id = ? ORDER BY uploaded_at DESC`, [targetId], (err, gallery) => {
                
                // Get User's Wall Comments
                db.all(`SELECT c.*, u.name as sender_name, u.profile_image as sender_image, u.id as sender_id 
                        FROM comments c 
                        JOIN users u ON c.sender_id = u.id 
                        WHERE c.receiver_id = ? 
                        ORDER BY c.created_at DESC`, [targetId], (err, comments) => {
                    
                    res.render('public_profile', { 
                        user: req.session.userName, 
                        profileUser: targetUser, 
                        sentiment,
                        gallery: gallery || [],
                        comments: comments || []
                    });
                });
            });
        });
    });
};

exports.postComment = (req, res) => {
    const senderId = req.session.userId;
    const receiverId = req.body.receiver_id;
    const content = req.body.content;

    db.run(`INSERT INTO comments (sender_id, receiver_id, content) VALUES (?, ?, ?)`, [senderId, receiverId, content], (err) => {
        res.redirect('/profile/' + receiverId);
    });
};

// Full Profile Views Page
exports.getAllProfileViews = (req, res) => {
    const userId = req.session.userId;
    
    // Fetch user details for the header
    User.findById(userId, (err, user) => {
        if(err || !user) return res.redirect('/dashboard');

        // Fetch ALL distinct views (grouped by user)
        const sql = `
            SELECT u.id, u.name, u.profile_image, u.city, u.country, u.birthdate, MAX(v.viewed_at) as viewed_at, COUNT(*) as view_count
            FROM profile_views v 
            JOIN users u ON v.viewer_id = u.id 
            WHERE v.profile_id = ? 
            GROUP BY v.viewer_id
            ORDER BY viewed_at DESC
            LIMIT 100
        `;
        
        db.all(sql, [userId], (err, views) => {
            if(err) console.error(err);
            res.render('profile_views', {
                user: user.name,
                views: views || [],
                activeTab: 'profile-views'
            });
        });
    });
};
