const User = require('../models/User');

exports.getRegister = (req, res) => {
    res.render('register', { error: null });
};

exports.postRegister = (req, res) => {
    // Basic Validation handled here or via middleware
    const { name, email, password, country, gender, birthdate, city, username } = req.body;

    if (!name || !email || !password || !username) {
        return res.render('register', { error: 'Required fields missing' });
    }

    User.create({ name, email, password, country, gender, birthdate, city, username }, (err, user) => {
        if (err) {
            console.error(err);
            if (err.message.includes('UNIQUE')) {
                return res.render('register', { error: 'Email or Username already exists' });
            }
            return res.render('register', { error: 'System Error' });
        }
        // Redirect to Login on success
        res.redirect('/login');
    });
};

exports.getLogin = (req, res) => {
    res.render('login', { error: null });
};

exports.postLogin = (req, res) => {
    const { email, password } = req.body;

    User.findByEmail(email, (err, user) => {
        if (err || !user) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const bcrypt = require('bcrypt');
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (isMatch) {
                req.session.userId = user.id;
                req.session.userName = user.name;
                req.session.userImage = user.profile_image;
                return res.redirect('/dashboard');
            } else {
                return res.render('login', { error: 'Invalid credentials' });
            }
        });
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
