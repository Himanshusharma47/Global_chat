const db = require('../database');
const bcrypt = require('bcrypt');

class User {
    static create(userData, callback) {
        const { name, email, password, country, gender, birthdate, city, username } = userData;
        
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return callback(err);
            
            const sql = `INSERT INTO users (name, email, password, country, gender, birthdate, city, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [name, email, hash, country, gender, birthdate, city, username], function(err) {
                if (err) return callback(err);
                callback(null, { id: this.lastID, ...userData });
            });
        });
    }

    static findByEmail(email, callback) {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], callback);
    }

    static findById(id, callback) {
        db.get(`SELECT * FROM users WHERE id = ?`, [id], callback);
    }

    static updateProfile(id, data, callback) {
        // Dynamic update - simple version
        const { name, bio, profile_image, country, city } = data;
        let sql = `UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio), country = COALESCE(?, country), city = COALESCE(?, city)`;
        let params = [name, bio, country, city];

        if (profile_image) {
            sql += `, profile_image = ?`;
            params.push(profile_image);
        }
        
        sql += ` WHERE id = ?`;
        params.push(id);

        db.run(sql, params, callback);
    }
}

module.exports = User;
