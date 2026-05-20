const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'reviews.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 name TEXT NOT NULL UNIQUE,
                                                 login TEXT UNIQUE,
                                                 password_xor TEXT,
                                                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
        if (err) console.error('Ошибка users:', err.message);
        else console.log('Таблица users готова');
    });

    db.run(`ALTER TABLE users ADD COLUMN login TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN password_xor TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
                                                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                   hotelId TEXT NOT NULL,
                                                   userId INTEGER NOT NULL,
                                                   rating INTEGER NOT NULL,
                                                   text TEXT NOT NULL,
                                                   date DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                   FOREIGN KEY (userId) REFERENCES users(id)
            )`, (err) => {
        if (err) console.error('Ошибка reviews:', err.message);
        else console.log('Таблица reviews готова');
    });

    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        hotelId TEXT NOT NULL,
        hotelName TEXT,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error('Ошибка bookings:', err.message);
        else console.log('Таблица bookings готова');
    });
});

module.exports = db;