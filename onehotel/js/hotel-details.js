let hotelData = null;
let currentPhotoIndex = 0;
let hotelPhotos = [];

let currentUser = null;

// Auth делегируется search-header.js (openAuthPanel, openProfilePanel, setLoggedInUser)
function showAuthModal() {
    if (window.openAuthPanel) window.openAuthPanel();
}
function hideAuthModal() {
    const p = document.getElementById('authPanel');
    if (p) { p.style.opacity='0'; setTimeout(()=>p.style.display='none',200); }
}
function initAuthModal() {
    // теперь инициализация в search-header.js
}

function initAuthButton() {
    // Синхронизируем currentUser из window (установлен search-header.js)
    if (window.currentUser) {
        currentUser = window.currentUser;
    } else {
        const savedUserId    = localStorage.getItem('userId');
        const savedUserName  = localStorage.getItem('userName');
        const savedFirstName = localStorage.getItem('userFirstName') || '';
        const savedLastName  = localStorage.getItem('userLastName')  || '';
        if (savedUserId && savedUserName) {
            currentUser = {
                id: parseInt(savedUserId),
                name: savedUserName,
                first_name: savedFirstName,
                last_name: savedLastName
            };
            window.currentUser = currentUser;
        }
    }
    // Показываем ФИ, никогда не показываем полный email
    const span = document.querySelector('.vhod .v1_7');
    if (span) {
        if (currentUser) {
            const fn = (currentUser.first_name || '').trim();
            const ln = (currentUser.last_name  || '').trim();
            let display = [fn, ln].filter(Boolean).join(' ');
            if (!display) {
                const n = currentUser.name || '';
                display = n.includes('@') ? n.split('@')[0] : n.slice(0, 12);
            }
            span.textContent = display;
        } else {
            span.textContent = 'Войти';
        }
    }
}

function getHotelIdFromData() {
    if (hotelData) {
        return hotelData.basicPropertyData?.id ||
            hotelData.id ||
            hotelData.originalData?.basicPropertyData?.id ||
            hotelData.originalData?.id;
    }
    // Фоллбэк — читаем id из localStorage-обёртки
    try {
        const raw = localStorage.getItem('selectedHotelData');
        if (raw) {
            const saved = JSON.parse(raw);
            return saved.id || null;
        }
    } catch(e) {}
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('hotel');
}

function loadHotelData() {
    // Грузим из localStorage — туда script.js кладёт данные при клике на карточку
    const raw = localStorage.getItem('selectedHotelData');
    if (!raw) {
        console.error('selectedHotelData не найден в localStorage');
        document.getElementById('dynamic-content').innerHTML = '<p>Отель не найден. Вернитесь к списку и выберите отель.</p>';
        return;
    }
    try {
        const saved = JSON.parse(raw);
        // saved содержит: id, name, rating, price, pricePerNight, currency, nights, adults, photo, originalData
        const data = saved.originalData || saved;
        // Пробрасываем поля из обёртки если originalData их не имеет
        if (!data.price && saved.price) data.price = saved.price;
        if (!data.photo && saved.photo) data.photo = saved.photo;
        renderHotelData(data);
    } catch (err) {
        console.error('Ошибка парсинга selectedHotelData:', err);
        document.getElementById('dynamic-content').innerHTML = '<p>Ошибка данных отеля.</p>';
    }
}
function renderHotelData(data) {
    if (!data) {
        console.error('renderHotelData: data = null');
        return;
    }
    hotelData = data;

    const displayName = hotelData.displayName?.text || hotelData.name || 'Отель';
    const basicData = hotelData.basicPropertyData || {};
    const reviewScore = (basicData.reviewScore?.score || hotelData.rating || 4.5) / 2;

    let locationText = 'Рим';
    if (hotelData.location) {
        if (hotelData.location.displayLocation) locationText = hotelData.location.displayLocation;
        else if (hotelData.location.mainDistance) locationText = hotelData.location.mainDistance;
        else if (hotelData.location.city) locationText = hotelData.location.city;
    } else if (basicData.location?.city) {
        locationText = basicData.location.city;
    }

    let desc = getHotelDescription(hotelData, basicData);
    const roomType = hotelData.matchingUnitConfigurations?.unitConfigurations?.[0]?.name;
    if (roomType && !desc.includes(roomType)) desc = roomType + '\n' + desc;

    let priceText = 'Цена не указана';
    // Сначала берём готовую цену из localStorage-обёртки (уже пересчитана по ночам и гостям)
    try {
        const raw = localStorage.getItem('selectedHotelData');
        if (raw) {
            const saved = JSON.parse(raw);
            if (saved.price) priceText = saved.price;
        }
    } catch(e) {}
    // Фоллбэк на данные из API
    if (priceText === 'Цена не указана') {
        if (hotelData.blocks && hotelData.blocks[0]?.finalPrice) {
            const amt = Math.round(hotelData.blocks[0].finalPrice.amount);
            const cur = hotelData.blocks[0].finalPrice.currency;
            priceText = `${amt} ${cur}`;
        } else if (hotelData.price) {
            priceText = hotelData.price;
        }
    }

    const hotelNameElem = document.getElementById('hotelName');
    if (hotelNameElem) hotelNameElem.innerText = displayName;

    const locationEl = document.getElementById('locationValue');
    if (locationEl) locationEl.innerText = locationText;

    updateStars(reviewScore);
    updatePhotoRating(reviewScore);

    const descElem = document.getElementById('hotelDescription');
    if (descElem) descElem.innerText = desc;

    const priceDisplay = document.getElementById('priceDisplay');
    if (priceDisplay) priceDisplay.innerText = priceText;

    loadPhotos();
    loadReviews();
    updatePriceBlockStyle();
}

function getHotelDescription(hotelData, basicData) {
    if (hotelData.originalData?.description?.text) return hotelData.originalData.description.text;
    if (hotelData.description?.text) return hotelData.description.text;
    if (typeof hotelData.description === 'string' && hotelData.description !== 'Без описания') return hotelData.description;
    if (basicData.description?.text) return basicData.description.text;

    const loc = hotelData.location || {};
    const basicLoc = basicData.location || {};
    const address = basicLoc.address;
    const city = basicLoc.city;
    const district = loc.displayLocation;
    const distance = loc.mainDistance;
    const rating = basicData.reviewScore?.score;
    const reviewCount = basicData.reviewScore?.reviewCount;
    const stars = basicData.starRating?.value;
    const room = hotelData.matchingUnitConfigurations?.unitConfigurations?.[0]?.name;
    const price = hotelData.blocks?.[0]?.finalPrice;
    const cancellation = hotelData.blocks?.[0]?.freeCancellationUntil;
    const onlyLeft = hotelData.blocks?.[0]?.onlyXLeftMessage?.translation;
    const discount = hotelData.priceDisplayInfoIrene?.discounts?.[0]?.name?.translation;
    const taxes = hotelData.priceDisplayInfoIrene?.chargesInfo?.translation;
    const policies = hotelData.policies || {};

    let parts = [];
    if (room) parts.push(room);
    if (stars) parts.push(`${stars}-звёздочный отель`);
    if (rating) {
        let text = `Рейтинг: ${rating}`;
        if (reviewCount) text += ` (${reviewCount} отзывов)`;
        parts.push(text);
    }
    if (address) parts.push(address);
    if (district) parts.push(`Район: ${district}`);
    if (city) parts.push(`Город: ${city}`);
    if (distance) parts.push(`До центра: ${distance}`);
    if (price) parts.push(`Цена за день: ${Math.round(price.amount)} ${price.currency}`);
    if (discount) parts.push(discount);
    if (taxes) parts.push(taxes);
    if (policies.showFreeCancellation) parts.push('Бесплатная отмена');
    if (policies.showNoPrepayment) parts.push('Без предоплаты');
    if (cancellation) {
        const date = new Date(cancellation).toLocaleDateString('ru-RU');
        parts.push(`Отмена до: ${date}`);
    }
    if (onlyLeft) parts.push(onlyLeft);

    return parts.length ? parts.join('\n') : 'Описание отсутствует';
}

function loadPhotos() {
    const photos = [];
    const mainPhoto = hotelData.basicPropertyData?.photos?.main;
    if (mainPhoto) {
        const url = mainPhoto.highResUrl?.relativeUrl || mainPhoto.lowResJpegUrl?.relativeUrl;
        if (url) photos.push('https://cf.bstatic.com' + url);
    }
    if (hotelData.photo) photos.push(hotelData.photo);
    if (photos.length === 0) photos.push('https://via.placeholder.com/900x400?text=Hotel+Image');

    hotelPhotos = [...new Set(photos)];
    currentPhotoIndex = 0;
    updatePhotoDisplay();
}

function updatePhotoDisplay() {
    const img = document.getElementById('mainPhoto');
    if (img && hotelPhotos.length) img.src = hotelPhotos[currentPhotoIndex];
    const counter = document.getElementById('photoCounter');
    if (counter) counter.innerText = `${currentPhotoIndex+1}/${hotelPhotos.length}`;
}

function nextPhoto() {
    if (hotelPhotos.length) currentPhotoIndex = (currentPhotoIndex + 1) % hotelPhotos.length;
    updatePhotoDisplay();
}

function prevPhoto() {
    if (hotelPhotos.length) currentPhotoIndex = (currentPhotoIndex - 1 + hotelPhotos.length) % hotelPhotos.length;
    updatePhotoDisplay();
}

function updateStars(rating) {
    const starsSpan = document.getElementById('ratingStars');
    if (!starsSpan) return;
    const full = Math.floor(rating);
    let starsHtml = '';
    for (let i = 0; i < full; i++) starsHtml += '★';
    while (starsHtml.length < 5) starsHtml += '☆';
    starsSpan.innerHTML = starsHtml + ` ${rating.toFixed(1)}`;
}

function updatePhotoRating(rating) {
    const badgeStars = document.querySelector('.photo-rating-badge .stars');
    const badgeValue = document.querySelector('.photo-rating-badge .rating-value');
    if (!badgeStars) return;
    const full = Math.floor(rating);
    let starsHtml = '';
    for (let i = 0; i < full; i++) starsHtml += '★';
    while (starsHtml.length < 5) starsHtml += '☆';
    badgeStars.innerHTML = starsHtml;
    if (badgeValue) badgeValue.innerText = rating.toFixed(1);
}

async function loadReviews() {
    const hotelId = getHotelIdFromData();
    if (!hotelId) {
        displayReviews([]);
        return;
    }
    try {
        const response = await fetch(`/api/hotels/${hotelId}/reviews`);
        if (response.ok) {
            const reviews = await response.json();
            displayReviews(reviews);
        } else {
            displayReviews([]);
        }
    } catch (err) {
        console.error('Ошибка загрузки отзывов:', err);
        displayReviews([]);
    }
}

function displayReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;
    if (!reviews.length) {
        container.innerHTML = '<div class="no-reviews">Пока нет отзывов</div>';
        return;
    }
    container.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="review-author">${escapeHtml(r.author)}</div>
                    <div class="review-date">${new Date(r.date).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="review-stars">${getStarsHtml(r.rating)}</div>
            </div>
            <div class="review-text">${escapeHtml(r.text)}</div>
        </div>
    `).join('');
}

function getStarsHtml(rating) {
    const full = Math.floor(rating);
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    for (let i = full; i < 5; i++) stars += '☆';
    return stars;
}

async function submitReview(hotelId, userId, rating, text) {
    if (!userId) {
        alert('Пожалуйста, войдите (нажмите на зелёную полосу и введите имя)');
        return false;
    }
    try {
        const response = await fetch(`/api/hotels/${hotelId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, rating, text })
        });
        if (response.ok) {
            loadReviews();
            return true;
        }
        return false;
    } catch(err) {
        console.error(err);
        return false;
    }
}

function initReviewForm() {
    const starContainer = document.getElementById('starRating');
    const ratingInput = document.getElementById('reviewRating');
    const submitBtn = document.getElementById('submitReview');
    const reviewText = document.getElementById('reviewText');
    if (!starContainer || !submitBtn) return;

    let currentRating = 5;
    function updateStarsUI(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) stars += (i <= rating) ? '★' : '☆';
        starContainer.innerHTML = stars;
        if (ratingInput) ratingInput.value = rating;
        currentRating = rating;
    }

    starContainer.addEventListener('click', (e) => {
        const rect = starContainer.getBoundingClientRect();
        const starWidth = rect.width / 5;
        const rating = Math.min(5, Math.max(1, Math.ceil((e.clientX - rect.left) / starWidth)));
        updateStarsUI(rating);
    });
    updateStarsUI(5);

    submitBtn.addEventListener('click', async () => {
        const text = reviewText.value.trim();
        if (!text) {
            alert('Напишите текст отзыва');
            return;
        }
        const hotelId = getHotelIdFromData();
        if (!hotelId) {
            alert('Отель не найден');
            return;
        }
        const success = await submitReview(hotelId, currentUser?.id, currentRating, text);
        if (success) {
            reviewText.value = '';
            updateStarsUI(5);
        } else {
            alert('Ошибка при отправке отзыва');
        }
    });
}

async function checkBookingStatus(hotelId, checkin, checkout) {
    try {
        const res = await fetch(`/api/hotels/${hotelId}/booking-status?checkin=${checkin}&checkout=${checkout}`);
        const data = await res.json();
        return data.booked;
    } catch (e) {
        return false;
    }
}

async function updatePriceBlockStyle() {
    const priceBlock = document.getElementById('priceBlock');
    if (!priceBlock) return;
    const hotelId = getHotelIdFromData();
    if (!hotelId) return;

    let { checkin, checkout } = window.searchState || {};
    if (!checkin || !checkout) {
        const datesSpan = document.querySelector('.dates-value');
        if (datesSpan && datesSpan.innerText.includes('-')) {
            const parts = datesSpan.innerText.split(' - ');
            if (parts.length === 2) {
                checkin = parts[0].trim();
                checkout = parts[1].trim();
            }
        }
    }
    if (!checkin || !checkout) return;

    const isBooked = await checkBookingStatus(hotelId, checkin, checkout);
    if (isBooked) {
        priceBlock.style.background = 'linear-gradient(90deg, #ff0000, #8b0000)';
        priceBlock.style.cursor = 'not-allowed';
        priceBlock.removeEventListener('click', bookNow);
        priceBlock.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Этот отель уже забронирован на выбранные даты');
        });
    } else {
        priceBlock.style.background = 'linear-gradient(90deg, #2cff00, #0b3d06)';
        priceBlock.style.cursor = 'pointer';
        priceBlock.removeEventListener('click', bookNow);
        priceBlock.addEventListener('click', bookNow);
    }
}

async function bookNow() {
    if (!currentUser) {
        alert('Войдите (нажмите на зелёную полосу и укажите имя)');
        return;
    }
    const hotelId = getHotelIdFromData();
    const hotelName = document.getElementById('hotelName')?.innerText || 'Отель';
    let { checkin, checkout } = window.searchState || {};
    if (!checkin || !checkout) {
        const datesSpan = document.querySelector('.dates-value');
        if (datesSpan && datesSpan.innerText.includes('-')) {
            const parts = datesSpan.innerText.split(' - ');
            checkin = parts[0].trim();
            checkout = parts[1].trim();
        }
    }
    if (!checkin || !checkout) {
        alert('Укажите даты поездки (кликните на поле "Даты")');
        return;
    }
    try {
        const response = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                hotelId,
                hotelName,
                checkin,
                checkout
            })
        });
        if (response.ok) {
            alert('Отель успешно забронирован!');
            updatePriceBlockStyle();
        } else if (response.status === 409) {
            const err = await response.json();
            alert(err.error || 'Отель уже забронирован на эти даты');
            updatePriceBlockStyle();
        } else {
            const err = await response.json();
            alert(err.error || 'Ошибка бронирования');
        }
    } catch(e) {
        console.error(e);
        alert('Ошибка сервера');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded событие сработало');
    initAuthButton();
    initAuthModal();
    loadHotelData();
    initReviewForm();

    document.getElementById('prevPhoto')?.addEventListener('click', prevPhoto);
    document.getElementById('nextPhoto')?.addEventListener('click', nextPhoto);
    document.getElementById('photoGallery')?.addEventListener('click', () => {
        document.getElementById('mainPhoto')?.requestFullscreen();
    });

    const searchState = {
        location: "Афины",
        checkin: "2026-04-24",
        checkout: "2026-04-29",
        adults: 2
    };
    window.searchState = searchState;

    const locationBlock = document.querySelector(".v4_2");
    const datesBlock = document.querySelector(".v4_3");
    const guestsBlock = document.querySelector(".v4_4");
    const searchBtn = document.querySelector(".strelka") || document.querySelector(".v4_11");
    const locationValueSpan = document.querySelector(".city-value");
    const datesValueSpan = document.querySelector(".dates-value");
    const guestsValueSpan = document.querySelector(".guests-value");

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
    function updateUI() {
        if (locationValueSpan) locationValueSpan.textContent = searchState.location;
        if (datesValueSpan) {
            datesValueSpan.textContent = `${formatDate(searchState.checkin)} - ${formatDate(searchState.checkout)}`;
        }
        if (guestsValueSpan) guestsValueSpan.textContent = "Гостей: " + searchState.adults;
    }
    // Клики по блокам поиска делегированы search-header.js
    // Восстанавливаем searchState из storage
    const _savedState = localStorage.getItem("hotelSearchState");
    if (_savedState) {
        try {
            const _parsed = JSON.parse(_savedState);
            if (window.searchState) Object.assign(window.searchState, _parsed);
        } catch(e) {}
    }

    if (searchBtn) {
        searchBtn.style.cursor = "pointer";
        searchBtn.addEventListener("click", () => {
            localStorage.setItem("hotelSearchState", JSON.stringify(window.searchState || {}));
            window.location.href = "../intent.html";
        });
    }

    const menuHome = document.querySelector('.menu-item');
    if (menuHome) {
        menuHome.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.setItem("hotelSearchState", JSON.stringify(window.searchState || {}));
            window.location.href = "../intent.html";
        });
    }
});