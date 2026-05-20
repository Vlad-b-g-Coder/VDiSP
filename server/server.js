const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Фронтенд лежит в папке выше (Lab4/), сервер — в Lab4/server/
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'intent.html'));
});

// Заглушка для Chrome DevTools
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
        console.log('🔍 Загрузка шаблона из:', templatePath);

        const raw = await fs.readFile(templatePath, 'utf-8');
        searchTemplate = JSON.parse(raw);
        console.log('✅ Шаблон forapi.json загружен успешно');
        console.log('📋 operationName:', searchTemplate.operationName);
        console.log('📋 Наличие variables:', !!searchTemplate.variables);
        console.log('📋 Наличие variables.input:', !!searchTemplate.variables?.input);
        console.log('📋 Наличие query:', !!searchTemplate.query);
    } catch (err) {
        console.error('❌ Ошибка загрузки forapi.json:', err.message);
        process.exit(1);
    }
}

// ── Добавляем колонки first_name / last_name если их нет (миграция) ──────────
function migrateUsersTable() {
    db.run(`ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN last_name  TEXT DEFAULT ''`, () => {});
}

const cityToDestId = {
    'рим': -126693, 'rome': -126693,
    'афины': -814876, 'athens': -814876,
    'афина': -814876,
    'athen': -814876
};

app.post('/api/search', async (req, res) => {
    console.log('='.repeat(60));
    console.log('🔵 ПОЛУЧЕН POST ЗАПРОС НА /api/search');
    console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));

    try {
        if (!searchTemplate) {
            console.error('❌ Шаблон не загружен');
            return res.status(500).json({ error: 'Шаблон поиска не загружен' });
        }

        const { location, checkin, checkout, adults } = req.body;

        if (!location || !checkin || !checkout || !adults) {
            console.error('❌ Не хватает параметров:', { location, checkin, checkout, adults });
            return res.status(400).json({ error: 'Не хватает параметров поиска' });
        }

        const destId = cityToDestId[location.toLowerCase().trim()];
        if (!destId) {
            console.error(`❌ Город "${location}" не поддерживается`);
            return res.status(400).json({ error: `Город "${location}" не поддерживается. Используйте: Афины, Рим` });
        }

        console.log(`🔍 Поиск: ${location} (${destId}), ${checkin} → ${checkout}, гостей: ${adults}`);

        const requestBody = JSON.parse(JSON.stringify(searchTemplate));

        if (requestBody.variables && requestBody.variables.input) {
            requestBody.variables.input.location.searchString = location;
            requestBody.variables.input.location.destId = destId;
            requestBody.variables.input.dates.checkin = checkin;
            requestBody.variables.input.dates.checkout = checkout;
            requestBody.variables.input.nbAdults = parseInt(adults);
            console.log('✅ Данные добавлены в шаблон');
        } else {
            console.error('❌ Структура шаблона не содержит variables.input');
            return res.status(500).json({ error: 'Неправильная структура шаблона' });
        }

        console.log('🚀 Отправка запроса в Booking.com...');

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

        console.log(`📡 Статус ответа от Booking.com: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Ошибка Booking.com: ${response.status}`, errorText.substring(0, 500));
            return res.status(502).json({ error: `Booking.com вернул ошибку: ${response.status}` });
        }

        const data = await response.json();
        console.log('📦 Получен ответ от Booking.com');

        let hotels = [];
        if (data?.data?.searchQueries?.search?.results) {
            hotels = data.data.searchQueries.search.results;
            console.log('✅ Отели найдены в data.data.searchQueries.search.results');
        } else if (data?.data?.search?.results) {
            hotels = data.data.search.results;
            console.log('✅ Отели найдены в data.data.search.results');
        } else {
            console.log('⚠️ Неизвестная структура ответа');
            console.log('Доступные ключи:', Object.keys(data));
            if (data.data) console.log('Ключи data.data:', Object.keys(data.data));
        }

        lastSearchResults = hotels.map((hotel, idx) => ({ ...hotel, searchIndex: idx }));
        console.log(`✅ Найдено отелей: ${hotels.length}`);
        console.log('='.repeat(60));

        res.json(hotels);
    } catch (err) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА в /api/search:', err.message);
        console.error(err.stack);
        console.log('='.repeat(60));
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// ── Регистрация — теперь принимает first_name и last_name ─────────────────────
app.post('/api/auth/register', (req, res) => {
    const { login, password, name, first_name, last_name } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    const userName = name || login;
    db.get('SELECT id FROM users WHERE login = ?', [login], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.status(409).json({ error: 'Логин уже используется' });
        db.get('SELECT id FROM users WHERE name = ?', [userName], (err, nameExists) => {
            if (err) return res.status(500).json({ error: err.message });
            createUser(
                login, password,
                nameExists ? `${userName}_${Date.now()}` : userName,
                first_name || '', last_name || '',
                res
            );
        });
    });
});

function createUser(login, password, name, first_name, last_name, res) {
    const encryptedPass = xorEncrypt(password, XOR_KEY);
    db.run(
        'INSERT INTO users (login, password_xor, name, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
        [login, encryptedPass, name, first_name, last_name],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT id, name, first_name, last_name FROM users WHERE id = ?', [this.lastID], (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({
                    id: user.id,
                    name: user.name,
                    first_name: user.first_name,
                    last_name: user.last_name
                });
            });
        }
    );
}

// ── Логин — возвращает first_name и last_name ─────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    db.get('SELECT * FROM users WHERE login = ?', [login], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
        if (xorEncrypt(password, XOR_KEY) !== user.password_xor) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        res.json({
            id: user.id,
            name: user.name,
            first_name: user.first_name || '',
            last_name: user.last_name || ''
        });
    });
});

// ── Обновление ФИ для существующего пользователя ─────────────────────────────
app.patch('/api/user/:id/name', (req, res) => {
    const { first_name, last_name } = req.body;
    if (!first_name && !last_name) return res.status(400).json({ error: 'Укажите имя или фамилию' });
    db.run(
        'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
        [first_name || '', last_name || '', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.post('/api/user/by-name', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Имя обязательно' });
    db.get('SELECT * FROM users WHERE name = ?', [name], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) return res.json({
            id: user.id, name: user.name,
            first_name: user.first_name || '',
            last_name: user.last_name || ''
        });
        db.run('INSERT INTO users (name) VALUES (?)', [name], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    id: newUser.id, name: newUser.name,
                    first_name: newUser.first_name || '',
                    last_name: newUser.last_name || ''
                });
            });
        });
    });
});

app.get('/api/hotels/:id', (req, res) => {
    if (!lastSearchResults || lastSearchResults.length === 0) {
        return res.status(404).json({ error: 'Нет результатов поиска. Сначала выполните поиск.' });
    }
    const param = req.params.id;
    const index = parseInt(param);
    let hotel = (!isNaN(index) && index >= 0 && index < lastSearchResults.length)
        ? lastSearchResults[index]
        : lastSearchResults.find(h => h.basicPropertyData?.id === parseInt(param));
    if (!hotel) return res.status(404).json({ error: 'Отель не найден' });
    res.json(hotel);
});

app.get('/api/hotels/:id/reviews', (req, res) => {
    db.all(
        `SELECT r.*,
                CASE
                    WHEN (u.first_name IS NOT NULL AND u.first_name != '') OR (u.last_name IS NOT NULL AND u.last_name != '')
                        THEN TRIM((COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')))
                    ELSE CASE WHEN u.name LIKE '%@%' THEN SUBSTR(u.name,1,INSTR(u.name,'@')-1) ELSE u.name END
                    END as author
         FROM reviews r JOIN users u ON r.userId = u.id WHERE r.hotelId = ? ORDER BY r.date DESC`,
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

app.post('/api/hotels/:id/reviews', (req, res) => {
    const { userId, rating, text } = req.body;
    if (!userId || !rating || !text) return res.status(400).json({ error: 'Не хватает полей' });
    const date = new Date().toISOString();
    db.run(
        'INSERT INTO reviews (hotelId, userId, rating, text, date) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, userId, rating, text, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT name, first_name, last_name FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                let author = 'Гость';
                if (user) {
                    const fn = (user.first_name || '').trim();
                    const ln = (user.last_name  || '').trim();
                    if (fn || ln) {
                        author = [fn, ln].filter(Boolean).join(" ");
                    } else {
                        author = user.name.includes("@") ? user.name.split("@")[0] : user.name;
                    }
                }
                res.status(201).json({ id: this.lastID, author, rating, text, date });
            });
        }
    );
});

app.get('/api/hotels/:hotelId/booking-status', (req, res) => {
    const { checkin, checkout } = req.query;
    if (!checkin || !checkout) return res.json({ booked: false });
    db.get(
        'SELECT * FROM bookings WHERE hotelId = ? AND checkin < ? AND checkout > ?',
        [req.params.hotelId, checkout, checkin],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ booked: !!row, booking: row });
        }
    );
});

app.post('/api/book', (req, res) => {
    const { userId, hotelId, hotelName, checkin, checkout } = req.body;
    if (!userId || !hotelId || !checkin || !checkout) return res.status(400).json({ error: 'Не хватает данных' });
    db.get(
        'SELECT * FROM bookings WHERE hotelId = ? AND checkin < ? AND checkout > ?',
        [hotelId, checkout, checkin],
        (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existing) return res.status(409).json({ error: 'Отель уже забронирован на эти даты' });
            db.run(
                'INSERT INTO bookings (userId, hotelId, hotelName, checkin, checkout) VALUES (?, ?, ?, ?, ?)',
                [userId, hotelId, hotelName, checkin, checkout],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, bookingId: this.lastID });
                }
            );
        }
    );
});

app.get('/api/bookings/user/:userId', (req, res) => {
    db.all(
        'SELECT * FROM bookings WHERE userId = ? ORDER BY booked_at DESC',
        [req.params.userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// Запуск сервера
async function startServer() {
    await loadSearchTemplate();
    migrateUsersTable(); // добавляет first_name/last_name если колонок нет
    app.listen(process.env.PORT || 3000, () => {
        console.log('');
        console.log('✅ Сервер запущен!');
        console.log('🌐 Откройте: http://localhost:3000');
        console.log('');
    });
}

startServer();