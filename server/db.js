const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            login TEXT UNIQUE,
            password_xor TEXT,
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            "hotelId" TEXT NOT NULL,
            "userId" INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            text TEXT NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES users(id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL,
            "hotelId" TEXT NOT NULL,
            "hotelName" TEXT,
            checkin DATE NOT NULL,
            checkout DATE NOT NULL,
            booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES users(id)
        )
    `);

    console.log('✅ БД инициализирована');
}

module.exports = { pool, initDB };