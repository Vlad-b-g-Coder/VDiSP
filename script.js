let allHotels = [];
let currentIndex = 0;
let isLoading = false;
let hasMore = true;
const HOTELS_PER_BATCH = 12;
let totalRowsRendered = 0;

let selectedHotel = null;

function createHotelCard(hotel, globalIndex) {
    const container = document.getElementById('dynamic-content');
    const startY = 313;
    const rowStep = 355;
    const leftX = 98;
    const rightX = 544;

    const row = Math.floor(globalIndex / 2);
    const col = globalIndex % 2;
    const topY = startY + row * rowStep;
    const leftXpos = col === 0 ? leftX : rightX;

    const hotelCard = document.createElement('div');
    hotelCard.className = 'hotel-card';
    hotelCard.style.position = 'absolute';
    hotelCard.style.left = leftXpos + 'px';
    hotelCard.style.top = topY + 'px';
    hotelCard.style.width = '430px';
    hotelCard.style.height = '350px';
    hotelCard.style.cursor = 'pointer';
    hotelCard.dataset.hotelId = hotel.id || globalIndex;
    hotelCard.dataset.hotelIndex = globalIndex;

    const imgWrapper = document.createElement('div');
    imgWrapper.style.position = 'relative';
    imgWrapper.style.left = '0px';
    imgWrapper.style.top = '42px';
    imgWrapper.style.width = '430px';
    imgWrapper.style.height = '200px';
    imgWrapper.style.borderRadius = '12px';
    imgWrapper.style.overflow = 'hidden';

    const img = document.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectPosition = 'center center';
    img.style.objectFit = 'cover';

    let photoUrl = null;
    const mainPhoto = hotel.basicPropertyData?.photos?.main;
    if (mainPhoto) {
        const relativeUrl = mainPhoto.highResUrl?.relativeUrl || mainPhoto.lowResJpegUrl?.relativeUrl;
        if (relativeUrl) {
            photoUrl = 'https://cf.bstatic.com' + relativeUrl;
        }
    }

    if (photoUrl) {
        img.src = photoUrl;
        img.alt = hotel.displayName?.text || 'Отель';
        img.onerror = function() {
            this.src = 'https://via.placeholder.com/430x200?text=No+Image';
        };
    } else {
        img.src = 'https://via.placeholder.com/430x200?text=No+Image';
        img.alt = 'Нет фото';
    }

    imgWrapper.appendChild(img);

    const rating = hotel.basicPropertyData?.reviewScore?.score / 2;
    if (rating && rating > 0) {
        const ratingBadge = document.createElement('div');
        ratingBadge.style.position = 'absolute';
        ratingBadge.style.top = '12px';
        ratingBadge.style.right = '12px';
        ratingBadge.style.background = 'linear-gradient(90deg, #2cff00, #0b3d06)';
        ratingBadge.style.color = 'white';
        ratingBadge.style.borderRadius = '30px';
        ratingBadge.style.padding = '6px 14px';
        ratingBadge.style.fontSize = '16px';
        ratingBadge.style.fontWeight = 'bold';
        ratingBadge.style.display = 'flex';
        ratingBadge.style.alignItems = 'center';
        ratingBadge.style.gap = '6px';
        ratingBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        ratingBadge.style.zIndex = '5';

        const starsSpan = document.createElement('span');
        const full = Math.floor(rating);
        let starsHtml = '';
        for (let i = 0; i < full; i++) starsHtml += '★';
        while (starsHtml.length < 5) starsHtml += '☆';
        starsSpan.innerHTML = starsHtml;
        starsSpan.style.fontSize = '14px';
        starsSpan.style.letterSpacing = '1px';

        const valueSpan = document.createElement('span');
        valueSpan.innerText = rating.toFixed(1);

        ratingBadge.appendChild(starsSpan);
        ratingBadge.appendChild(valueSpan);
        imgWrapper.appendChild(ratingBadge);
    }

    hotelCard.appendChild(imgWrapper);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'hostel-info';
    infoDiv.style.position = 'absolute';
    infoDiv.style.left = '0px';
    infoDiv.style.top = '245px';
    hotelCard.appendChild(infoDiv);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'hostel-name';
    nameSpan.style.position = 'absolute';
    nameSpan.style.left = '60px';
    nameSpan.style.top = '255px';
    const name = hotel.displayName?.text || 'Без названия';
    nameSpan.innerText = name;
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.fontSize = '25px';
    nameSpan.style.color = '#333';
    hotelCard.appendChild(nameSpan);

    const priceBtn = document.createElement('div');
    priceBtn.className = 'hostel-price-btn';
    priceBtn.style.position = 'absolute';
    priceBtn.style.left = '270px';
    priceBtn.style.top = '265px';
    priceBtn.style.width = '129px';
    priceBtn.style.height = '82px';
    priceBtn.style.background = 'linear-gradient(90deg, rgba(109,255,42,1), rgba(0,134,35,1))';
    priceBtn.style.borderRadius = '16px';
    priceBtn.style.border = '1px solid black';
    priceBtn.style.display = 'flex';
    priceBtn.style.alignItems = 'center';
    priceBtn.style.justifyContent = 'center';
    hotelCard.appendChild(priceBtn);

    let priceTextContent = 'Цена не указана';
    if (hotel.blocks && hotel.blocks.length > 0 && hotel.blocks[0].finalPrice) {
        const amount = hotel.blocks[0].finalPrice.amount;
        const currency = hotel.blocks[0].finalPrice.currency;
        if (amount) priceTextContent = `${Math.round(amount)} ${currency}`;
    }

    const priceSpan = document.createElement('span');
    priceSpan.className = 'hostel-price-text';
    priceSpan.style.position = 'static';
    priceSpan.innerText = priceTextContent;
    priceSpan.style.fontWeight = 'bold';
    priceSpan.style.color = '#072307';
    priceSpan.style.fontSize = '20px';
    priceSpan.style.textAlign = 'center';
    priceSpan.style.whiteSpace = 'nowrap';

    priceBtn.appendChild(priceSpan);

    hotelCard.addEventListener('click', (e) => {
        e.stopPropagation();
        handleHotelSelect(hotel, globalIndex);
    });

    container.appendChild(hotelCard);
}

function handleHotelSelect(hotel, index) {
    selectedHotel = {
        id: hotel.id || index,
        name: hotel.displayName?.text || 'Без названия',
        rating: hotel.basicPropertyData?.reviewScore?.score || '—',
        price: getHotelPrice(hotel),
        photo: getHotelPhoto(hotel),
        originalData: hotel
    };
    navigateToBookingSite(selectedHotel);
}

function getHotelPrice(hotel) {
    if (hotel.blocks && hotel.blocks.length > 0 && hotel.blocks[0].finalPrice) {
        const amount = hotel.blocks[0].finalPrice.amount;
        const currency = hotel.blocks[0].finalPrice.currency;
        if (amount) return `${Math.round(amount)} ${currency}`;
    }
    return 'Цена не указана';
}

function getHotelPhoto(hotel) {
    const mainPhoto = hotel.basicPropertyData?.photos?.main;
    if (mainPhoto) {
        const relativeUrl = mainPhoto.highResUrl?.relativeUrl || mainPhoto.lowResJpegUrl?.relativeUrl;
        if (relativeUrl) {
            return 'https://cf.bstatic.com' + relativeUrl;
        }
    }
    return null;
}

function navigateToBookingSite(hotelData) {
    console.log('сейв в localStorage:', hotelData);
    localStorage.setItem('selectedHotelData', JSON.stringify(hotelData));
    const hotelPageUrl = `onehotel/index.html?id=${hotelData.id}`;
    window.location.href = hotelPageUrl;
}

function getSelectedHotel() {
    return selectedHotel;
}

function clearSelectedHotel() {
    selectedHotel = null;
    localStorage.removeItem('selectedHotel');
}

async function loadMoreHotels() {
    if (isLoading || !hasMore) return;

    isLoading = true;

    let loader = document.getElementById('loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.position = 'fixed';
        loader.style.bottom = '20px';
        loader.style.left = '50%';
        loader.style.transform = 'translateX(-50%)';
        loader.style.backgroundColor = '#333';
        loader.style.color = 'white';
        loader.style.padding = '10px 20px';
        loader.style.borderRadius = '20px';
        loader.style.zIndex = '1000';
        loader.style.fontSize = '14px';
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
    loader.innerText = 'Загрузка';

    await new Promise(resolve => setTimeout(resolve, 300));

    const nextBatch = allHotels.slice(currentIndex, currentIndex + HOTELS_PER_BATCH);

    if (nextBatch.length === 0) {
        hasMore = false;
        loader.innerText = 'Все отели загружены';
        setTimeout(() => { loader.style.display = 'none'; }, 2000);
        isLoading = false;
        return;
    }

    nextBatch.forEach((hotel) => {
        createHotelCard(hotel, currentIndex);
        currentIndex++;
    });

    hasMore = currentIndex < allHotels.length;
    loader.style.display = 'none';
    isLoading = false;

    setTimeout(checkScrollAndLoad, 100);
}

function checkScrollAndLoad() {
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const clientHeight = window.innerHeight;

    if (scrollHeight - scrollTop - clientHeight < 400 && !isLoading && hasMore) {
        loadMoreHotels();
    }
}

function scaleSiteWrapper() {
    const wrapper = document.querySelector('.site-wrapper');
    if (!wrapper) return;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const blockWidth = 1080;
    const blockHeight = 1920;
    const scale = Math.min(windowWidth / blockWidth, windowHeight / blockHeight);
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'center center';
}

// ── Основная функция поиска отелей ───────────────────
// Объявлена ДО window.addEventListener('load'), чтобы
// window.loadHotelsBySearch был доступен сразу при загрузке
async function loadHotelsBySearch() {
    const state = window.searchState || {};
    const location = state.location || "Афины";
    const checkin  = state.checkin  || "2026-06-10";
    const checkout = state.checkout || "2026-06-15";
    const adults   = state.adults   || 2;

    // Сброс
    allHotels    = [];
    currentIndex = 0;
    hasMore      = true;
    isLoading    = false;

    const container = document.getElementById("dynamic-content");
    if (container) container.innerHTML = "";

    let loader = document.getElementById("loader");
    if (!loader) {
        loader = document.createElement("div");
        loader.id = "loader";
        loader.style.position = "fixed";
        loader.style.bottom = "20px";
        loader.style.left = "50%";
        loader.style.transform = "translateX(-50%)";
        loader.style.backgroundColor = "#333";
        loader.style.color = "white";
        loader.style.padding = "10px 20px";
        loader.style.borderRadius = "20px";
        loader.style.zIndex = "1000";
        loader.style.fontSize = "14px";
        document.body.appendChild(loader);
    }
    loader.style.display = "block";
    loader.innerText = "Ищем отели...";

    try {
        const res = await fetch("http://localhost:3000/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location, checkin, checkout, adults })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        allHotels = Array.isArray(data) ? data : (data.hotels || []);
        loader.style.display = "none";

        if (allHotels.length === 0) {
            if (container) {
                container.innerHTML = `<div style="
                    position:absolute; top:100px; left:50%;
                    transform:translateX(-50%);
                    font-size:28px; color:#888;
                    font-family:'Inter',sans-serif;
                    text-align:center;
                ">Отели не найдены</div>`;
            }
            return;
        }

        await loadMoreHotels();

    } catch (e) {
        console.error("loadHotelsBySearch error:", e);
        loader.innerText = "Ошибка загрузки";
        setTimeout(() => { loader.style.display = "none"; }, 3000);
    }
}

// Экспортируем ДО события load
window.loadHotelsBySearch = loadHotelsBySearch;

window.addEventListener('hotelSelected', (event) => {
    console.log('Событие выбора отеля:', event.detail);
});

window.addEventListener('load', () => {
    scaleSiteWrapper();

    const savedSearchState = localStorage.getItem("hotelSearchState");
    if (savedSearchState) {
        try {
            const parsed = JSON.parse(savedSearchState);
            if (window.searchState) {
                window.searchState.location = parsed.location;
                window.searchState.checkin  = parsed.checkin;
                window.searchState.checkout = parsed.checkout;
                window.searchState.adults   = parsed.adults;
            } else {
                window.searchState = parsed;
            }
            const citySpan   = document.querySelector(".city-value");
            const datesSpan  = document.querySelector(".dates-value");
            const guestsSpan = document.querySelector(".guests-value");
            if (citySpan)   citySpan.textContent   = parsed.location;
            if (datesSpan)  datesSpan.textContent  = `${parsed.checkin} — ${parsed.checkout}`;
            if (guestsSpan) guestsSpan.textContent = `Гостей: ${parsed.adults}`;
        } catch(e) {}
    }

    // Здесь loadHotelsBySearch гарантированно определена
    loadHotelsBySearch();
});

window.addEventListener('resize', scaleSiteWrapper);

window.HotelSelection = {
    getSelectedHotel,
    clearSelectedHotel,
    navigateToBookingSite
};