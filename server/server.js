require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'intent.html'));
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.json({ version: '1.0' });
});

let lastSearchResults = null;
let searchTemplate = null;
const XOR_KEY = 'IliaTakeZaradku';

function xorEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

async function loadSearchTemplate() {
    try {
        const templatePath = path.join(__dirname, 'forapi.json');
        const raw = await fs.readFile(templatePath, 'utf-8');
        searchTemplate = JSON.parse(raw);
        console.log('✅ Шаблон forapi.json загружен');
    } catch (err) {
        console.error('❌ Ошибка загрузки forapi.json:', err.message);
        process.exit(1);
    }
}

const cityToDestId = {
    'рим': -126693, 'rome': -126693,
    'афины': -814876, 'athens': -814876,
    'афина': -814876,
    'athen': -814876
};

app.post('/api/search', async (req, res) => {
    try {
        if (!searchTemplate) return res.status(500).json({ error: 'Шаблон поиска не загружен' });
        const { location, checkin, checkout, adults } = req.body;
        if (!location || !checkin || !checkout || !adults)
            return res.status(400).json({ error: 'Не хватает параметров поиска' });

        const destId = cityToDestId[location.toLowerCase().trim()];
        if (!destId) return res.status(400).json({ error: `Город "${location}" не поддерживается. Используйте: Афины, Рим` });

        const requestBody = JSON.parse(JSON.stringify(searchTemplate));
        requestBody.variables.input.location.searchString = location;
        requestBody.variables.input.location.destId = destId;
        requestBody.variables.input.dates.checkin = checkin;
        requestBody.variables.input.dates.checkout = checkout;
        requestBody.variables.input.nbAdults = parseInt(adults);

        const response = await fetch('https://www.booking.com/dml/graphql', {
            method: 'POST',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'content-type': 'application/json',
                'accept': 'application/json',
                'accept-language': 'ru-RU,ru;q=0.9',
                'apollographql-client-name': 'b-search-web-searchresults',
                'origin': 'https://www.booking.com',
                'referer': 'https://www.booking.com/searchresults.ru.html'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) return res.status(502).json({ error: `Booking.com вернул ошибку: ${response.status}` });

        const data = await response.json();
        let hotels = data?.data?.searchQueries?.search?.results || data?.data?.search?.results || [];
        lastSearchResults = hotels.map((hotel, idx) => ({ ...hotel, searchIndex: idx }));
        res.json(hotels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { login, password, name, first_name, last_name } = req.body;
        if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
        const userName = name || login;

        const existing = await pool.query('SELECT id FROM users WHERE login = $1', [login]);
        if (existing.rows.length) return res.status(409).json({ error: 'Логин уже используется' });

        const nameExists = await pool.query('SELECT id FROM users WHERE name = $1', [userName]);
        const finalName = nameExists.rows.length ? `${userName}_${Date.now()}` : userName;
        const encryptedPass = xorEncrypt(password, XOR_KEY);

        const result = await pool.query(
            'INSERT INTO users (login, password_xor, name, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, first_name, last_name',
            [login, encryptedPass, finalName, first_name || '', last_name || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

        const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
        if (xorEncrypt(password, XOR_KEY) !== user.password_xor)
            return res.status(401).json({ error: 'Неверный логин или пароль' });

        res.json({ id: user.id, name: user.name, first_name: user.first_name || '', last_name: user.last_name || '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/user/:id/name', async (req, res) => {
    try {
        const { first_name, last_name } = req.body;
        await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3',
            [first_name || '', last_name || '', req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/user/by-name', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Имя обязательно' });

        const existing = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
        if (existing.rows.length) {
            const u = existing.rows[0];
            return res.json({ id: u.id, name: u.name, first_name: u.first_name || '', last_name: u.last_name || '' });
        }

        const result = await pool.query(
            'INSERT INTO users (name) VALUES ($1) RETURNING *',
            [name]
        );
        const u = result.rows[0];
        res.json({ id: u.id, name: u.name, first_name: u.first_name || '', last_name: u.last_name || '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/hotels/:id', (req, res) => {
    if (!lastSearchResults || lastSearchResults.length === 0)
        return res.status(404).json({ error: 'Нет результатов поиска. Сначала выполните поиск.' });

    const param = req.params.id;
    const index = parseInt(param);
    let hotel = (!isNaN(index) && index >= 0 && index < lastSearchResults.length)
        ? lastSearchResults[index]
        : lastSearchResults.find(h => h.basicPropertyData?.id === parseInt(param));

    if (!hotel) return res.status(404).json({ error: 'Отель не найден' });
    res.json(hotel);
});

app.get('/api/hotels/:id/reviews', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*,
                CASE
                    WHEN (u.first_name IS NOT NULL AND u.first_name != '') OR (u.last_name IS NOT NULL AND u.last_name != '')
                        THEN TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')))
                    ELSE CASE WHEN u.name LIKE '%@%' THEN SPLIT_PART(u.name,'@',1) ELSE u.name END
                END as author
             FROM reviews r JOIN users u ON r."userId" = u.id WHERE r."hotelId" = $1 ORDER BY r.date DESC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/hotels/:id/reviews', async (req, res) => {
    try {
        const { userId, rating, text } = req.body;
        if (!userId || !rating || !text) return res.status(400).json({ error: 'Не хватает полей' });

        const date = new Date().toISOString();
        const result = await pool.query(
            'INSERT INTO reviews ("hotelId", "userId", rating, text, date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.params.id, userId, rating, text, date]
        );

        const userResult = await pool.query('SELECT name, first_name, last_name FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        let author = 'Гость';
        if (user) {
            const fn = (user.first_name || '').trim();
            const ln = (user.last_name || '').trim();
            author = (fn || ln) ? [fn, ln].filter(Boolean).join(' ')
                : user.name.includes('@') ? user.name.split('@')[0] : user.name;
        }

        res.status(201).json({ id: result.rows[0].id, author, rating, text, date });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/hotels/:hotelId/booking-status', async (req, res) => {
    try {
        const { checkin, checkout } = req.query;
        if (!checkin || !checkout) return res.json({ booked: false });

        const result = await pool.query(
            'SELECT * FROM bookings WHERE "hotelId" = $1 AND checkin < $2 AND checkout > $3',
            [req.params.hotelId, checkout, checkin]
        );
        res.json({ booked: result.rows.length > 0, booking: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/book', async (req, res) => {
    try {
        const { userId, hotelId, hotelName, checkin, checkout } = req.body;
        if (!userId || !hotelId || !checkin || !checkout)
            return res.status(400).json({ error: 'Не хватает данных' });

        const existing = await pool.query(
            'SELECT * FROM bookings WHERE "hotelId" = $1 AND checkin < $2 AND checkout > $3',
            [hotelId, checkout, checkin]
        );
        if (existing.rows.length) return res.status(409).json({ error: 'Отель уже забронирован на эти даты' });

        const result = await pool.query(
            'INSERT INTO bookings ("userId", "hotelId", "hotelName", checkin, checkout) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [userId, hotelId, hotelName, checkin, checkout]
        );
        res.json({ success: true, bookingId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookings/user/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bookings WHERE "userId" = $1 ORDER BY booked_at DESC',
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function startServer() {
    await loadSearchTemplate();
    await initDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✅ Сервер запущен на порту ${PORT}`);
    });
}

startServer();