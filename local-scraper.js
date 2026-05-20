/**
 * local-scraper.js
 *
 * Локальный прокси-скрапер для Booking.com GraphQL.
 * Запускать на своей машине: node local-scraper.js
 * Слушает на http://localhost:3001
 *
 * Основной server.js должен обращаться сюда, а не напрямую к booking.com
 *
 * Установка зависимостей:
 *   npm install express node-fetch https-proxy-agent user-agents
 *
 * (node-fetch v2 — CommonJS совместимый)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const fetch   = require('node-fetch'); // npm i node-fetch@2

const app  = express();
app.use(express.json());

// ── Конфиг ────────────────────────────────────────────────────────────────────

const PORT         = process.env.SCRAPER_PORT || 3001;
const TEMPLATE_PATH = process.env.TEMPLATE_PATH || path.join(__dirname, 'backend', 'forapi.json');

// Опциональный HTTP-прокси (например Luminati / Bright Data / любой SOCKS5→HTTP)
// Формат: http://user:pass@host:port  или пусто — без прокси
const PROXY_URL = process.env.BOOKING_PROXY || '';

// ── Пул User-Agent'ов (ротация) ───────────────────────────────────────────────
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Задержка между запросами (анти-бан) ──────────────────────────────────────
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Случайная задержка 0.8 – 2.5 сек
function randomDelay() {
    return delay(800 + Math.random() * 1700);
}

// ── Заголовки запроса к Booking.com ──────────────────────────────────────────
function buildHeaders(location) {
    return {
        'Content-Type':                  'application/json',
        'Accept':                        'application/json, text/plain, */*',
        'Accept-Language':               'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding':               'gzip, deflate, br',
        'Origin':                        'https://www.booking.com',
        'Referer':                       `https://www.booking.com/searchresults.ru.html?ss=${encodeURIComponent(location)}`,
        'User-Agent':                    randomUA(),
        'apollographql-client-name':     'b-search-web-searchresults',
        'apollographql-client-version':  'd83c0fb',
        'x-booking-context-action-name': 'searchresults',
        'x-booking-context-aid':         '304142',
        'x-booking-csrf-token':          '',   // пусто — сработает без него для большинства запросов
        'x-booking-et-serialized-state': '',
        'x-booking-pageview-id':         Math.random().toString(36).slice(2),
        'sec-ch-ua':                     '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile':              '?0',
        'sec-ch-ua-platform':            '"Windows"',
        'sec-fetch-dest':                'empty',
        'sec-fetch-mode':                'cors',
        'sec-fetch-site':                'same-origin',
        'Connection':                    'keep-alive',
    };
}

// ── Маппинг городов → destId ─────────────────────────────────────────────────
const CITY_MAP = {
    'афины':   -814876, 'athens':  -814876,
    'афина':   -814876, 'athen':   -814876,
    'рим':     -126693, 'rome':    -126693,
    'paris':   -1456928, 'париж': -1456928,
    'berlin':  -1746443, 'берлин': -1746443,
    'london':  -2601889, 'лондон': -2601889,
    'barcelona': -372490, 'барселона': -372490,
    'madrid':  -390625, 'мадрид': -390625,
    'amsterdam': -2140479, 'амстердам': -2140479,
    'prague':  -553173, 'прага': -553173,
    'vienna':  -1995499, 'вена': -1995499,
    'istanbul': -755070, 'стамбул': -755070,
    'dubai':   -782831, 'дубай': -782831,
};

function getDestId(locationStr) {
    return CITY_MAP[locationStr.toLowerCase().trim()] ?? null;
}

// ── Загрузка шаблона запроса ─────────────────────────────────────────────────
let searchTemplate = null;

function loadTemplate() {
    if (searchTemplate) return true;
    try {
        const raw = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
        searchTemplate = JSON.parse(raw);
        console.log('✅ Шаблон forapi.json загружен из', TEMPLATE_PATH);
        return true;
    } catch (e) {
        console.error('❌ Не могу прочитать шаблон:', e.message);
        console.error('   Укажите путь через переменную TEMPLATE_PATH=./forapi.json node local-scraper.js');
        return false;
    }
}

// ── Строим тело GraphQL-запроса ───────────────────────────────────────────────
function buildRequestBody(location, destId, checkin, checkout, adults) {
    const body = JSON.parse(JSON.stringify(searchTemplate)); // глубокая копия

    // Пытаемся подставить параметры в известные места шаблона
    try {
        body.variables.input.location.searchString = location;
        body.variables.input.location.destId       = destId;
        body.variables.input.dates.checkin          = checkin;
        body.variables.input.dates.checkout         = checkout;
        body.variables.input.nbAdults               = parseInt(adults) || 2;
    } catch (e) {
        // Если структура шаблона другая — подставляем рекурсивно
        patchDeep(body, { searchString: location, destId, checkin, checkout, nbAdults: parseInt(adults) || 2 });
    }

    return body;
}

// Вспомогалка: рекурсивная замена ключей
function patchDeep(obj, patches) {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
        if (key in patches) obj[key] = patches[key];
        else patchDeep(obj[key], patches);
    }
}

// ── Основной запрос к Booking.com с retry ────────────────────────────────────
async function fetchBooking(body, location, attempt = 1) {
    const MAX_ATTEMPTS = 3;

    let fetchOptions = {
        method:  'POST',
        headers: buildHeaders(location),
        body:    JSON.stringify(body),
        timeout: 20000,
    };

    // Подключаем прокси если задан
    if (PROXY_URL) {
        const { HttpsProxyAgent } = require('https-proxy-agent'); // npm i https-proxy-agent
        fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    }

    await randomDelay();

    const response = await fetch('https://www.booking.com/dml/graphql', fetchOptions);
    const rawText  = await response.text();

    console.log(`📡 Booking.com [attempt ${attempt}] status: ${response.status}, body: ${rawText.slice(0, 200)}`);

    if (response.status === 429 || response.status === 403) {
        if (attempt < MAX_ATTEMPTS) {
            const wait = 3000 * attempt;
            console.log(`⏳ Rate-limited, ждём ${wait}ms и повторяем...`);
            await delay(wait);
            return fetchBooking(body, location, attempt + 1);
        }
        throw new Error(`Booking.com вернул ${response.status} после ${MAX_ATTEMPTS} попыток`);
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 300)}`);
    }

    let data;
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new Error('Booking.com вернул не-JSON: ' + rawText.slice(0, 300));
    }

    return data;
}

// ── Маршрут /api/search ───────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
    const { location, checkin, checkout, adults } = req.body || {};

    console.log(`🔍 /api/search: location="${location}" checkin=${checkin} checkout=${checkout} adults=${adults}`);

    if (!location || !checkin || !checkout) {
        return res.status(400).json({ error: 'Не хватает параметров: location, checkin, checkout обязательны' });
    }

    if (!loadTemplate()) {
        return res.status(500).json({ error: 'Шаблон forapi.json не загружен. Проверьте путь TEMPLATE_PATH.' });
    }

    const destId = getDestId(location);
    if (!destId) {
        return res.status(400).json({
            error: `Город "${location}" не найден в маппинге`,
            supportedCities: Object.keys(CITY_MAP).filter((_, i) => i % 2 === 0) // только русские варианты
        });
    }

    try {
        const body = buildRequestBody(location, destId, checkin, checkout, adults);
        const data = await fetchBooking(body, location);

        const hotels =
            data?.data?.searchQueries?.search?.results ||
            data?.data?.search?.results ||
            [];

        console.log(`✅ Найдено отелей: ${hotels.length}`);

        res.json({ success: true, count: hotels.length, hotels });

    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', template: !!searchTemplate }));

// ── Старт ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 local-scraper запущен на http://localhost:${PORT}`);
    console.log(`   POST /api/search  — поиск отелей`);
    console.log(`   GET  /health      — проверка состояния`);
    if (PROXY_URL) console.log(`   🌐 Прокси: ${PROXY_URL}`);
    else           console.log(`   ⚠️  Прокси не задан (прямой запрос с вашего IP)`);
    loadTemplate();
});