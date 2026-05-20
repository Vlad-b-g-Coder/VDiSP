/**
 * script.js — работает со статичным hotels_data.json
 * Цена пересчитывается динамически: pricePerNight × ночей × коэф_гостей
 */

let allHotels    = [];
let currentIndex = 0;
let isLoading    = false;
let hasMore      = true;
const HOTELS_PER_BATCH = 12;

let selectedHotel = null;

// ── Коэффициент цены в зависимости от количества гостей ──────────────────────
// 1 гость = базовая цена (×1.0)
// Каждый доп. гость добавляет ~60% от базы (можно подкрутить)
function guestMultiplier(adults) {
    const multipliers = { 1: 1.0, 2: 1.6, 3: 2.1, 4: 2.5 };
    return multipliers[adults] || 1.0 + (adults - 1) * 0.55;
}

// ── Итоговая цена с учётом ночей и гостей ────────────────────────────────────
function calcPrice(hotel, nights, adults) {
    const base = hotel.pricePerNight;
    if (!base) return null;
    return Math.round(base * nights * guestMultiplier(adults));
}

function formatPrice(amount, currency) {
    if (!amount) return 'Цена не указана';
    return `${amount} ${currency || 'EUR'}`;
}

// ── Карточка отеля ────────────────────────────────────────────────────────────
function createHotelCard(hotel, globalIndex) {
    const container = document.getElementById('dynamic-content');
    const startY = 313;
    const rowStep = 355;
    const leftX  = 98;
    const rightX = 544;

    const row    = Math.floor(globalIndex / 2);
    const col    = globalIndex % 2;
    const topY   = startY + row * rowStep;
    const leftXpos = col === 0 ? leftX : rightX;

    const hotelCard = document.createElement('div');
    hotelCard.className = 'hotel-card';
    hotelCard.style.cssText = `position:absolute;left:${leftXpos}px;top:${topY}px;width:430px;height:350px;cursor:pointer;`;
    hotelCard.dataset.hotelId    = hotel.id || globalIndex;
    hotelCard.dataset.hotelIndex = globalIndex;

    // Фото
    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = 'position:relative;left:0;top:42px;width:430px;height:200px;border-radius:12px;overflow:hidden;';

    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;';

    const mainPhoto = hotel.basicPropertyData?.photos?.main;
    const relativeUrl = mainPhoto?.highResUrl?.relativeUrl || mainPhoto?.lowResJpegUrl?.relativeUrl;
    img.src = relativeUrl ? 'https://cf.bstatic.com' + relativeUrl : 'https://via.placeholder.com/430x200?text=No+Image';
    img.alt = hotel.displayName?.text || 'Отель';
    img.onerror = function() { this.src = 'https://via.placeholder.com/430x200?text=No+Image'; };
    imgWrapper.appendChild(img);

    // Рейтинг
    const rating = (hotel.basicPropertyData?.reviewScore?.score || 0) / 2;
    if (rating > 0) {
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:12px;right:12px;background:linear-gradient(90deg,#2cff00,#0b3d06);color:white;border-radius:30px;padding:6px 14px;font-size:16px;font-weight:bold;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:5;';
        const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
        badge.innerHTML = `<span style="font-size:14px;letter-spacing:1px">${stars}</span><span>${rating.toFixed(1)}</span>`;
        imgWrapper.appendChild(badge);
    }
    hotelCard.appendChild(imgWrapper);

    // Название
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'position:absolute;left:60px;top:255px;font-weight:bold;font-size:25px;color:#333;';
    nameSpan.innerText = hotel.displayName?.text || 'Без названия';
    hotelCard.appendChild(nameSpan);

    // Кнопка с ценой (пересчитывается динамически)
    const priceBtn = document.createElement('div');
    priceBtn.className = 'hotel-price-btn';
    priceBtn.style.cssText = 'position:absolute;left:270px;top:265px;width:129px;height:82px;background:linear-gradient(90deg,rgba(109,255,42,1),rgba(0,134,35,1));border-radius:16px;border:1px solid black;display:flex;align-items:center;justify-content:center;';

    const priceSpan = document.createElement('span');
    priceSpan.style.cssText = 'font-weight:bold;color:#072307;font-size:20px;text-align:center;white-space:nowrap;';

    // Первоначальный расчёт из текущего searchState
    const state   = window.searchState || {};
    const nights  = calcNights(state.checkin, state.checkout) || 1;
    const adults  = state.adults || 1;
    const amount  = calcPrice(hotel, nights, adults);
    priceSpan.innerText = formatPrice(amount, hotel.currency);

    // Сохраняем ссылку для обновления при смене дат/гостей
    hotelCard.dataset.hotelIndex = globalIndex;
    priceSpan.dataset.priceTarget = 'true';

    priceBtn.appendChild(priceSpan);
    hotelCard.appendChild(priceBtn);

    hotelCard.addEventListener('click', (e) => {
        e.stopPropagation();
        handleHotelSelect(hotel, globalIndex);
    });

    container.appendChild(hotelCard);
}

// ── Пересчёт всех цен на странице (вызывается при смене дат/гостей) ──────────
function updateAllPrices() {
    const state  = window.searchState || {};
    const nights = calcNights(state.checkin, state.checkout) || 1;
    const adults = state.adults || 1;

    document.querySelectorAll('.hotel-card').forEach(card => {
        const idx      = parseInt(card.dataset.hotelIndex);
        const hotel    = allHotels[idx];
        if (!hotel) return;
        const span     = card.querySelector('[data-price-target]');
        if (!span) return;
        const amount   = calcPrice(hotel, nights, adults);
        span.innerText = formatPrice(amount, hotel.currency);
    });
}

// Экспортируем для вызова из search-header.js после смены дат/гостей
window.updateAllPrices = updateAllPrices;

// ── Считаем количество ночей из двух дат ─────────────────────────────────────
function calcNights(checkin, checkout) {
    if (!checkin || !checkout) return 1;
    const a = new Date(checkin);
    const b = new Date(checkout);
    const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
}

// ── Выбор отеля ──────────────────────────────────────────────────────────────
function handleHotelSelect(hotel, index) {
    const state  = window.searchState || {};
    const nights = calcNights(state.checkin, state.checkout) || 1;
    const adults = state.adults || 1;
    const amount = calcPrice(hotel, nights, adults);

    selectedHotel = {
        id:          hotel.id || index,
        name:        hotel.displayName?.text || 'Без названия',
        rating:      hotel.basicPropertyData?.reviewScore?.score || '—',
        price:       formatPrice(amount, hotel.currency),
        pricePerNight: hotel.pricePerNight,
        currency:    hotel.currency,
        nights,
        adults,
        photo:       getHotelPhoto(hotel),
        originalData: hotel
    };
    navigateToBookingSite(selectedHotel);
}

function getHotelPhoto(hotel) {
    const mainPhoto = hotel.basicPropertyData?.photos?.main;
    const relativeUrl = mainPhoto?.highResUrl?.relativeUrl || mainPhoto?.lowResJpegUrl?.relativeUrl;
    return relativeUrl ? 'https://cf.bstatic.com' + relativeUrl : null;
}

function navigateToBookingSite(hotelData) {
    localStorage.setItem('selectedHotelData', JSON.stringify(hotelData));
    window.location.href = `onehotel/index.html?id=${hotelData.id}`;
}

function getSelectedHotel()  { return selectedHotel; }
function clearSelectedHotel() {
    selectedHotel = null;
    localStorage.removeItem('selectedHotel');
}

// ── Пагинация (подгрузка порциями) ───────────────────────────────────────────
async function loadMoreHotels() {
    if (isLoading || !hasMore) return;
    isLoading = true;

    let loader = document.getElementById('loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:20px;z-index:1000;font-size:14px;';
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
    loader.innerText = 'Загрузка...';

    await new Promise(r => setTimeout(r, 200));

    const batch = allHotels.slice(currentIndex, currentIndex + HOTELS_PER_BATCH);
    if (batch.length === 0) {
        hasMore = false;
        loader.innerText = 'Все отели загружены';
        setTimeout(() => { loader.style.display = 'none'; }, 2000);
        isLoading = false;
        return;
    }

    batch.forEach(() => {
        createHotelCard(allHotels[currentIndex], currentIndex);
        currentIndex++;
    });

    hasMore = currentIndex < allHotels.length;
    loader.style.display = 'none';
    isLoading = false;
    setTimeout(checkScrollAndLoad, 100);
}

function checkScrollAndLoad() {
    const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
    if (scrollHeight - scrollTop - clientHeight < 400 && !isLoading && hasMore) {
        loadMoreHotels();
    }
}

// ── Главная функция — загрузка из статики ─────────────────────────────────────
async function loadHotelsBySearch() {
    const state    = window.searchState || {};
    const location = state.location || 'Афины';

    allHotels    = [];
    currentIndex = 0;
    hasMore      = true;
    isLoading    = false;

    const container = document.getElementById('dynamic-content');
    if (container) container.innerHTML = '';

    let loader = document.getElementById('loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 20px;border-radius:20px;z-index:1000;font-size:14px;';
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
    loader.innerText = 'Загружаем отели...';

    try {
        // Грузим статичный JSON — никаких запросов к booking.com!
        const response = await fetch('/hotels_data.json');
        if (!response.ok) throw new Error('hotels_data.json не найден');

        const data = await response.json();

        // Ищем по городу (регистронезависимо)
        const key = Object.keys(data).find(
            k => k.toLowerCase() === location.toLowerCase()
        );

        allHotels = key ? data[key] : [];
        loader.style.display = 'none';

        if (allHotels.length === 0) {
            if (container) container.innerHTML = `
                <div style="position:absolute;top:100px;left:50%;transform:translateX(-50%);font-size:28px;color:#888;font-family:'Inter',sans-serif;text-align:center;">
                    Отели не найдены для города «${location}»
                </div>`;
            return;
        }

        await loadMoreHotels();

    } catch (e) {
        console.error('loadHotelsBySearch error:', e);
        loader.innerText = 'Ошибка: ' + e.message;
        setTimeout(() => { loader.style.display = 'none'; }, 4000);
        if (container) container.innerHTML = `
            <div style="position:absolute;top:100px;left:50%;transform:translateX(-50%);font-size:24px;color:#888;font-family:'Inter',sans-serif;text-align:center;">
                Ошибка загрузки отелей<br>
                <small style="font-size:16px;">${e.message}</small>
            </div>`;
    }
}

window.loadHotelsBySearch = loadHotelsBySearch;

// ── Масштабирование обёртки ───────────────────────────────────────────────────
function scaleSiteWrapper() {
    const wrapper = document.querySelector('.site-wrapper');
    if (!wrapper) return;
    const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'center center';
}

// ── Инициализация ─────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    scaleSiteWrapper();

    const saved = localStorage.getItem('hotelSearchState');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            window.searchState = Object.assign(window.searchState || {}, p);
            const citySpan   = document.querySelector('.city-value');
            const datesSpan  = document.querySelector('.dates-value');
            const guestsSpan = document.querySelector('.guests-value');
            if (citySpan)   citySpan.textContent   = p.location;
            if (datesSpan)  datesSpan.textContent  = `${p.checkin} — ${p.checkout}`;
            if (guestsSpan) guestsSpan.textContent = `Гостей: ${p.adults}`;
        } catch(e) {}
    }

    loadHotelsBySearch();
});

window.addEventListener('resize', scaleSiteWrapper);
window.addEventListener('scroll', checkScrollAndLoad);

window.HotelSelection = { getSelectedHotel, clearSelectedHotel, navigateToBookingSite };