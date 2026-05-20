/* =====================================================
   search-header.js  — с поддержкой Фамилии и Имени
   ===================================================== */

// ── Состояние поиска ──────────────────────────────────
const searchState = {
    location: "Афины",
    checkin: "2026-06-10",
    checkout: "2026-06-15",
    adults: 2
};
window.searchState = searchState;

// ── Загрузка сохранённого состояния ───────────────────
(function loadSavedState() {
    const saved = localStorage.getItem("hotelSearchState");
    if (saved) {
        try {
            const p = JSON.parse(saved);
            Object.assign(searchState, p);
        } catch(e) {}
    }
})();

function saveSearchState() {
    localStorage.setItem("hotelSearchState", JSON.stringify(searchState));
}

// ── Список поддерживаемых городов ─────────────────────
const CITIES = [
    { label: "Афины",  value: "Афины",  flag: "🇬🇷" },
    { label: "Рим",    value: "Рим",    flag: "🇮🇹" },
];

// ── Вспомогательные форматировщики ────────────────────
function formatDateRU(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function updateUI() {
    const citySpan   = document.querySelector(".city-value");
    const datesSpan  = document.querySelector(".dates-value");
    const guestsSpan = document.querySelector(".guests-value");
    if (citySpan)   citySpan.textContent   = searchState.location;
    if (datesSpan)  datesSpan.textContent  = `${formatDateRU(searchState.checkin)} — ${formatDateRU(searchState.checkout)}`;
    if (guestsSpan) guestsSpan.textContent = `Гостей: ${searchState.adults}`;
}
updateUI();

// ═══════════════════════════════════════════════════════
//  ОБЩАЯ ФАБРИКА ПАНЕЛЕЙ
// ═══════════════════════════════════════════════════════
function createOverlay(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.style.cssText = `
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,0.55); z-index:8000;
        backdrop-filter:blur(4px);
    `;
    document.body.appendChild(el);
    return el;
}

function showOverlay(id) { document.getElementById(id).style.display = "block"; }
function hideOverlay(id) { document.getElementById(id).style.display = "none"; }

// ═══════════════════════════════════════════════════════
//  ПАНЕЛЬ ВЫБОРА ГОРОДА
// ═══════════════════════════════════════════════════════
function buildCityPanel() {
    if (document.getElementById("cityPanel")) return;

    const overlay = createOverlay("cityOverlay");
    overlay.addEventListener("click", closeCityPanel);

    const panel = document.createElement("div");
    panel.id = "cityPanel";
    panel.style.cssText = `
        display:none; position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%) scale(0.95);
        background:#fff; border-radius:10px;
        padding:20px 22px; width:540px; max-width:92vw;
        z-index:9000; box-shadow:0 12px 40px rgba(0,0,0,0.3);
        font-family:'Inter',sans-serif;
        transition:transform .2s ease, opacity .2s ease;
        opacity:0;
    `;

    panel.innerHTML = `
        <h2 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#111;">Куда едем?</h2>
        <div id="cityList" style="display:flex;flex-direction:column;gap:8px;"></div>
    `;

    const list = panel.querySelector("#cityList");
    CITIES.forEach(city => {
        const btn = document.createElement("button");
        btn.style.cssText = `
            display:flex; align-items:center; gap:12px;
            padding:10px 14px; border-radius:6px;
            border:2px solid ${city.value === searchState.location ? '#2cff00' : '#e8e8e8'};
            background:${city.value === searchState.location ? '#f0fff0' : '#fafafa'};
            cursor:pointer; font-size:22px; font-family:'Inter',sans-serif;
            font-weight:600; color:#222; transition:.15s;
            width:100%; text-align:left;
        `;
        btn.innerHTML = `<span style="font-size:36px">${city.flag}</span> ${city.label}`;
        btn.addEventListener("click", () => {
            searchState.location = city.value;
            updateUI();
            saveSearchState();
            closeCityPanel();
        });
        list.appendChild(btn);
    });

    document.body.appendChild(panel);
}

function openCityPanel() {
    buildCityPanel();
    showOverlay("cityOverlay");
    const panel = document.getElementById("cityPanel");
    panel.style.display = "block";
    requestAnimationFrame(() => {
        panel.style.transform = "translate(-50%,-50%) scale(1)";
        panel.style.opacity   = "1";
    });
    document.querySelectorAll("#cityList button").forEach(btn => {
        const isActive = btn.textContent.trim().includes(searchState.location);
        btn.style.borderColor = isActive ? "#2cff00" : "#e8e8e8";
        btn.style.background  = isActive ? "#f0fff0"  : "#fafafa";
    });
}

function closeCityPanel() {
    hideOverlay("cityOverlay");
    const panel = document.getElementById("cityPanel");
    if (panel) {
        panel.style.transform = "translate(-50%,-50%) scale(0.95)";
        panel.style.opacity   = "0";
        setTimeout(() => { panel.style.display = "none"; }, 200);
    }
}

// ═══════════════════════════════════════════════════════
//  ПАНЕЛЬ КАЛЕНДАРЯ
// ═══════════════════════════════════════════════════════
let calSelectState = { step: "checkin", checkin: null, checkout: null };

function buildCalendarPanel() {
    if (document.getElementById("calPanel")) return;

    const overlay = createOverlay("calOverlay");
    overlay.addEventListener("click", closeCalPanel);

    const panel = document.createElement("div");
    panel.id = "calPanel";
    panel.style.cssText = `
        display:none; position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%) scale(0.95); opacity:0;
        background:#fff; border-radius:10px;
        padding:18px 20px 16px; width:640px; max-width:96vw;
        z-index:9000; box-shadow:0 12px 40px rgba(0,0,0,0.3);
        font-family:'Inter',sans-serif;
        transition:transform .2s ease, opacity .2s ease;
    `;
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 id="calTitle" style="margin:0;font-size:22px;font-weight:700;color:#111;">Выберите даты</h2>
            <button id="calCloseBtn" style="background:none;border:none;font-size:28px;cursor:pointer;color:#555;">&times;</button>
        </div>
        <div id="calSelectedDates" style="display:flex;gap:10px;margin-bottom:14px;">
            <div id="calCheckinLabel"  style="flex:1;padding:8px 12px;border-radius:6px;border:2px solid #e0e0e0;font-size:18px;color:#444;"></div>
            <div id="calCheckoutLabel" style="flex:1;padding:8px 12px;border-radius:6px;border:2px solid #e0e0e0;font-size:18px;color:#444;"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <button id="calPrev" style="background:none;border:none;font-size:26px;cursor:pointer;padding:4px 10px;border-radius:6px;color:#333;">&#8249;</button>
            <span id="calMonthLabel" style="font-size:20px;font-weight:600;"></span>
            <button id="calNext" style="background:none;border:none;font-size:26px;cursor:pointer;padding:4px 10px;border-radius:6px;color:#333;">&#8250;</button>
        </div>
        <div id="calGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>
        <button id="calConfirmBtn" style="
            width:100%;margin-top:12px;padding:12px;
            background:linear-gradient(90deg,#2cff00,#0b3d06);
            border:none;border-radius:6px;font-size:22px;
            font-weight:700;color:#072307;cursor:pointer;
            opacity:0.4;pointer-events:none;transition:.2s;
        ">Выбрать</button>
    `;
    document.body.appendChild(panel);

    document.getElementById("calCloseBtn").addEventListener("click", closeCalPanel);
    document.getElementById("calPrev").addEventListener("click", () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCal(); });
    document.getElementById("calNext").addEventListener("click", () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCal(); });
    document.getElementById("calConfirmBtn").addEventListener("click", confirmDates);
}

let calMonth, calYear;

function openCalPanel() {
    buildCalendarPanel();
    const now = new Date(searchState.checkin + "T00:00:00");
    calMonth = now.getMonth();
    calYear  = now.getFullYear();
    calSelectState = { step: "checkin", checkin: searchState.checkin, checkout: searchState.checkout };
    showOverlay("calOverlay");
    const panel = document.getElementById("calPanel");
    panel.style.display = "block";
    requestAnimationFrame(() => {
        panel.style.transform = "translate(-50%,-50%) scale(1)";
        panel.style.opacity   = "1";
    });
    renderCal();
    updateCalLabels();
}

function closeCalPanel() {
    hideOverlay("calOverlay");
    const panel = document.getElementById("calPanel");
    if (panel) {
        panel.style.transform = "translate(-50%,-50%) scale(0.95)";
        panel.style.opacity   = "0";
        setTimeout(() => { panel.style.display = "none"; }, 200);
    }
}

function updateCalLabels() {
    const ci  = document.getElementById("calCheckinLabel");
    const co  = document.getElementById("calCheckoutLabel");
    const btn = document.getElementById("calConfirmBtn");
    ci.textContent = calSelectState.checkin  ? "Заезд: "  + formatDateRU(calSelectState.checkin)  : "Выберите заезд";
    co.textContent = calSelectState.checkout ? "Выезд: " + formatDateRU(calSelectState.checkout) : "Выберите выезд";
    ci.style.borderColor = calSelectState.step === "checkin"  ? "#2cff00" : "#e0e0e0";
    co.style.borderColor = calSelectState.step === "checkout" ? "#2cff00" : "#e0e0e0";
    const ready = calSelectState.checkin && calSelectState.checkout;
    btn.style.opacity = ready ? "1" : "0.4";
    btn.style.pointerEvents = ready ? "auto" : "none";
    document.getElementById("calTitle").textContent = calSelectState.step === "checkin" ? "Дата заезда" : "Дата выезда";
}

function renderCal() {
    const grid  = document.getElementById("calGrid");
    const label = document.getElementById("calMonthLabel");
    if (!grid) return;
    const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    label.textContent = `${monthNames[calMonth]} ${calYear}`;
    grid.innerHTML = "";
    ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(d => {
        const h = document.createElement("div");
        h.textContent = d;
        h.style.cssText = "text-align:center;font-size:20px;font-weight:600;color:#888;padding:6px 0;";
        grid.appendChild(h);
    });
    const firstDay = new Date(calYear, calMonth, 1);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;
    for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement("div"));
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today  = new Date(); today.setHours(0,0,0,0);
    const ciDate = calSelectState.checkin  ? new Date(calSelectState.checkin  + "T00:00:00") : null;
    const coDate = calSelectState.checkout ? new Date(calSelectState.checkout + "T00:00:00") : null;
    for (let d = 1; d <= daysInMonth; d++) {
        const cell     = document.createElement("button");
        const cellDate = new Date(calYear, calMonth, d);
        const dateStr  = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const isPast      = cellDate < today;
        const isCheckin   = ciDate && cellDate.getTime() === ciDate.getTime();
        const isCheckout  = coDate && cellDate.getTime() === coDate.getTime();
        const isInRange   = ciDate && coDate && cellDate > ciDate && cellDate < coDate;
        let bg = "#fff", color = "#222", border = "1px solid #e8e8e8";
        if (isCheckin || isCheckout) { bg = "linear-gradient(135deg,#2cff00,#0b8a00)"; color = "#072307"; border = "none"; }
        else if (isInRange)          { bg = "#d4ffcf"; border = "1px solid #a8e8a0"; }
        if (isPast) color = "#ccc";
        cell.style.cssText = `background:${bg};color:${color};border:${border};border-radius:10px;padding:10px 0;font-size:22px;cursor:${isPast?"not-allowed":"pointer"};font-family:'Inter',sans-serif;font-weight:500;transition:.12s;`;
        cell.textContent = d;
        cell.disabled    = isPast;
        cell.addEventListener("click", () => {
            if (calSelectState.step === "checkin") {
                calSelectState.checkin = dateStr; calSelectState.checkout = null; calSelectState.step = "checkout";
            } else {
                if (dateStr <= calSelectState.checkin) {
                    calSelectState.checkin = dateStr; calSelectState.checkout = null; calSelectState.step = "checkout";
                } else {
                    calSelectState.checkout = dateStr; calSelectState.step = "done";
                }
            }
            renderCal(); updateCalLabels();
        });
        grid.appendChild(cell);
    }
}

function confirmDates() {
    if (!calSelectState.checkin || !calSelectState.checkout) return;
    searchState.checkin  = calSelectState.checkin;
    searchState.checkout = calSelectState.checkout;
    updateUI(); saveSearchState(); closeCalPanel();
    if (typeof updatePriceBlockStyle === "function") updatePriceBlockStyle();
}

// ═══════════════════════════════════════════════════════
//  ПАНЕЛЬ ГОСТЕЙ
// ═══════════════════════════════════════════════════════
function buildGuestsPanel() {
    if (document.getElementById("guestsPanel")) return;
    const overlay = createOverlay("guestsOverlay");
    overlay.addEventListener("click", closeGuestsPanel);
    const panel = document.createElement("div");
    panel.id = "guestsPanel";
    panel.style.cssText = `
        display:none; position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%) scale(0.95); opacity:0;
        background:#fff; border-radius:10px;
        padding:20px 22px; width:440px; max-width:92vw;
        z-index:9000; box-shadow:0 12px 40px rgba(0,0,0,0.3);
        font-family:'Inter',sans-serif;
        transition:transform .2s ease, opacity .2s ease;
    `;
    panel.innerHTML = `
        <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111;">Гости</h2>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <span style="font-size:22px;font-weight:500;color:#333;">Взрослые</span>
            <div style="display:flex;align-items:center;gap:12px;">
                <button id="guestsMinus" style="width:44px;height:44px;border-radius:50%;border:2px solid #ddd;background:#f5f5f5;font-size:26px;cursor:pointer;font-weight:700;color:#333;">−</button>
                <span id="guestsCount" style="font-size:28px;font-weight:700;min-width:30px;text-align:center;">${searchState.adults}</span>
                <button id="guestsPlus"  style="width:44px;height:44px;border-radius:50%;border:2px solid #2cff00;background:#f0fff0;font-size:26px;cursor:pointer;font-weight:700;color:#0b3d06;">+</button>
            </div>
        </div>
        <button id="guestsConfirm" style="
            width:100%;padding:12px;
            background:linear-gradient(90deg,#2cff00,#0b3d06);
            border:none;border-radius:6px;font-size:22px;
            font-weight:700;color:#072307;cursor:pointer;
        ">Готово</button>
    `;
    document.body.appendChild(panel);
    document.getElementById("guestsMinus").addEventListener("click", () => {
        const c = document.getElementById("guestsCount");
        c.textContent = Math.max(1, parseInt(c.textContent) - 1);
    });
    document.getElementById("guestsPlus").addEventListener("click", () => {
        const c = document.getElementById("guestsCount");
        c.textContent = parseInt(c.textContent) + 1;
    });
    document.getElementById("guestsConfirm").addEventListener("click", () => {
        searchState.adults = parseInt(document.getElementById("guestsCount").textContent);
        updateUI(); saveSearchState(); closeGuestsPanel();
    });
}

function openGuestsPanel() {
    buildGuestsPanel();
    document.getElementById("guestsCount").textContent = searchState.adults;
    showOverlay("guestsOverlay");
    const panel = document.getElementById("guestsPanel");
    panel.style.display = "block";
    requestAnimationFrame(() => {
        panel.style.transform = "translate(-50%,-50%) scale(1)";
        panel.style.opacity   = "1";
    });
}
function closeGuestsPanel() {
    hideOverlay("guestsOverlay");
    const panel = document.getElementById("guestsPanel");
    if (panel) {
        panel.style.transform = "translate(-50%,-50%) scale(0.95)";
        panel.style.opacity   = "0";
        setTimeout(() => { panel.style.display = "none"; }, 200);
    }
}

// ═══════════════════════════════════════════════════════
//  АВТОРИЗАЦИЯ: логин/регистрация + Google
// ═══════════════════════════════════════════════════════
window.currentUser = null;

(function restoreUser() {
    const id         = localStorage.getItem("userId");
    const name       = localStorage.getItem("userName");
    const first_name = localStorage.getItem("userFirstName");
    const last_name  = localStorage.getItem("userLastName");
    if (id && name) {
        window.currentUser = { id: parseInt(id), name, first_name: first_name || '', last_name: last_name || '' };
    }
})();

// ── Поля формы авторизации ───────────────────────────
function buildAuthPanel() {
    if (document.getElementById("authPanel")) return;

    const overlay = createOverlay("authOverlay");
    overlay.addEventListener("click", closeAuthPanel);

    const panel = document.createElement("div");
    panel.id = "authPanel";
    panel.style.cssText = `
        display:none; position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%) scale(0.95); opacity:0;
        background:#fff; border-radius:10px;
        padding:24px 28px; width:580px; max-width:94vw;
        z-index:9000; box-shadow:0 12px 50px rgba(0,0,0,0.35);
        font-family:'Inter',sans-serif;
        transition:transform .2s ease, opacity .2s ease;
    `;

    const fieldStyle = `
        width:100%;margin-bottom:10px;padding:12px 16px;
        font-size:22px;border:2px solid #e0e0e0;border-radius:6px;
        box-sizing:border-box;font-family:'Inter',sans-serif;outline:none;
    `;

    panel.innerHTML = `
        <button id="authClose" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:32px;cursor:pointer;color:#555;">&times;</button>
        <h2 id="authTitle" style="margin:0 0 18px;font-size:28px;font-weight:700;text-align:center;color:#111;">Вход</h2>

        <!-- Google -->
        <div style="margin-bottom:14px;display:flex;justify-content:center;">
            <button id="googleSignInBtn" style="
                display:flex;align-items:center;gap:10px;
                padding:10px 20px;border-radius:6px;
                border:2px solid #dadce0;background:#fff;
                font-size:22px;font-weight:500;cursor:pointer;
                font-family:'Inter',sans-serif;color:#3c4043;
                box-shadow:0 2px 6px rgba(0,0,0,0.1);
                width:100%;justify-content:center;transition:.15s;
            ">
                <svg width="28" height="28" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Войти через Google
            </button>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="flex:1;height:1px;background:#e0e0e0;"></div>
            <span style="font-size:22px;color:#aaa;">или</span>
            <div style="flex:1;height:1px;background:#e0e0e0;"></div>
        </div>

        <input type="text"     id="authLogin"     placeholder="Логин"              style="${fieldStyle}">
        <input type="password" id="authPassword"  placeholder="Пароль"             style="${fieldStyle}">

        <!-- Поля только для регистрации -->
        <input type="text"     id="authFirstName" placeholder="Имя"                style="${fieldStyle}display:none;">
        <input type="text"     id="authLastName"  placeholder="Фамилия"            style="${fieldStyle}display:none;">
        <input type="text"     id="authName"      placeholder="Никнейм (опционально)" style="${fieldStyle}display:none;">

        <div id="authError" style="color:#c00;font-size:18px;min-height:22px;margin-bottom:6px;text-align:center;"></div>

        <button id="authSubmit" style="
            width:100%;padding:14px;
            background:linear-gradient(90deg,#2cff00,#0b3d06);
            border:none;border-radius:6px;
            font-size:24px;font-weight:700;color:#072307;cursor:pointer;
        ">Войти</button>
        <button id="authToggle" style="
            width:100%;margin-top:10px;padding:10px;
            background:none;border:none;color:#0b3d06;
            font-size:20px;cursor:pointer;text-decoration:underline;
        ">Нет аккаунта? Зарегистрироваться</button>
    `;
    document.body.appendChild(panel);

    document.getElementById("authClose").addEventListener("click", closeAuthPanel);
    document.getElementById("googleSignInBtn").addEventListener("click", initiateGoogleAuth);

    let isLogin = true;

    document.getElementById("authToggle").addEventListener("click", () => {
        isLogin = !isLogin;
        document.getElementById("authTitle").textContent  = isLogin ? "Вход" : "Регистрация";
        document.getElementById("authSubmit").textContent = isLogin ? "Войти" : "Зарегистрироваться";
        document.getElementById("authToggle").textContent = isLogin
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти";

        // Показываем поля ФИ только при регистрации
        const regOnly = ["authFirstName", "authLastName", "authName"];
        regOnly.forEach(id => {
            document.getElementById(id).style.display = isLogin ? "none" : "block";
        });
        document.getElementById("authError").textContent = "";
    });

    document.getElementById("authSubmit").addEventListener("click", async () => {
        const login      = document.getElementById("authLogin").value.trim();
        const password   = document.getElementById("authPassword").value.trim();
        const first_name = document.getElementById("authFirstName").value.trim();
        const last_name  = document.getElementById("authLastName").value.trim();
        const name       = document.getElementById("authName").value.trim();
        const errEl      = document.getElementById("authError");

        if (!login || !password) { errEl.textContent = "Заполните логин и пароль"; return; }

        const url  = isLogin
            ? "/api/auth/login"
            : "/api/auth/register";
        const body = isLogin
            ? { login, password }
            : { login, password, name: name || login, first_name, last_name };

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const user = await res.json();
                setLoggedInUser(user);
                closeAuthPanel();
            } else {
                const err = await res.json();
                errEl.textContent = err.error || "Ошибка авторизации";
            }
        } catch(e) {
            errEl.textContent = "Нет соединения с сервером";
        }
    });
}

function openAuthPanel() {
    buildAuthPanel();
    showOverlay("authOverlay");
    const panel = document.getElementById("authPanel");
    panel.style.display = "block";
    requestAnimationFrame(() => {
        panel.style.transform = "translate(-50%,-50%) scale(1)";
        panel.style.opacity   = "1";
    });
}
function closeAuthPanel() {
    hideOverlay("authOverlay");
    const panel = document.getElementById("authPanel");
    if (panel) {
        panel.style.transform = "translate(-50%,-50%) scale(0.95)";
        panel.style.opacity   = "0";
        setTimeout(() => { panel.style.display = "none"; }, 200);
    }
}

function setLoggedInUser(user) {
    window.currentUser = {
        id:         user.id,
        name:       user.name,
        first_name: user.first_name || '',
        last_name:  user.last_name  || ''
    };
    console.log("RAW user object:", JSON.stringify(user));
    console.log("first_name bytes:", [...(user.first_name||'')].map(c => c.charCodeAt(0).toString(16)));

    localStorage.setItem("userId",        user.id);
    localStorage.setItem("userName",      user.name);
    localStorage.setItem("userLogin",     user.login || user.name || '');
    localStorage.setItem("userFirstName", user.first_name || '');
    localStorage.setItem("userLastName",  user.last_name  || '');
    updateAuthButton();
    if (typeof loadReviews === "function") loadReviews();
    if (typeof updatePriceBlockStyle === "function") updatePriceBlockStyle();
}

// Кнопка шапки показывает «Имя Фамилия» если они заданы, иначе первую часть логина
function updateAuthButton() {
    const btn = document.getElementById("vhodBtn");
    if (!btn) return;
    if (window.currentUser) {
        const { first_name, last_name, name } = window.currentUser;

        // Берём первую букву имени и первую букву фамилии
        const a = (first_name || name || '').charAt(0).toUpperCase();
        const b = (last_name || '').charAt(0).toUpperCase();
        const display = b ? a + b : a;

        const span = btn.querySelector(".v1_7") || btn;
        span.textContent = display;
    } else {
        const span = btn.querySelector(".v1_7") || btn;
        span.textContent = "Войти";
    }
}

// ── Google OAuth ─────────────────────────────────────
function initiateGoogleAuth() {
    const hasGoogleEndpoint = false;
    if (hasGoogleEndpoint) {
        const popup = window.open("/auth/google", "googleAuth", "width=500,height=600");
        window.addEventListener("message", function handler(e) {
            if (e.data?.type === "google-auth-success") {
                setLoggedInUser(e.data.user);
                closeAuthPanel();
                window.removeEventListener("message", handler);
            }
        });
    } else {
        if (window.google && window.google.accounts) {
            window.google.accounts.id.initialize({
                client_id: "1093051853990-r5cvrmjfso7bf9qp8e044ah8las4tfrn.apps.googleusercontent.com",
                callback: handleGoogleCredential
            });
            window.google.accounts.id.prompt();
        } else {
            document.getElementById("authError").textContent = "Google Sign-In: добавьте client_id в search-header.js";
        }
    }
}

async function handleGoogleCredential(response) {
    try {
        const parts   = response.credential.split(".");
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(
            decodeURIComponent(
                atob(base64).split('').map(c =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join('')
            )
        );        const name    = payload.name || payload.email;
        const login   = payload.email;
        const first_name = payload.given_name  || '';
        const last_name  = payload.family_name || '';

        const res = await fetch("/api/user/by-name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: login })
        });
        if (res.ok) {
            const user = await res.json();
            setLoggedInUser({ id: user.id, name: name || user.name, first_name, last_name });
            closeAuthPanel();
        }
    } catch(e) {
        console.error("Google auth error:", e);
    }
}

// ═══════════════════════════════════════════════════════
//  ПРОФИЛЬ — боковая панель (показывает ФИ)
// ═══════════════════════════════════════════════════════
function buildProfilePanel() {
    if (document.getElementById("profilePanel")) return;

    const overlay = createOverlay("profileOverlay");
    overlay.addEventListener("click", closeProfilePanel);

    const panel = document.createElement("div");
    panel.id = "profilePanel";
    panel.style.cssText = `
        display:none; position:fixed; top:0; right:-480px;
        width:460px; height:100vh;
        background:#fff; z-index:9000;
        box-shadow:-8px 0 40px rgba(0,0,0,0.25);
        font-family:'Inter',sans-serif;
        transition:right .3s cubic-bezier(.4,0,.2,1);
        overflow-y:auto;
        padding:0 0 40px;
    `;

    panel.innerHTML = `
        <div style="
            background:linear-gradient(135deg,#2cff00 0%,#0b3d06 100%);
            padding:24px 24px 18px; position:relative;
        ">
            <button id="profileClose" style="
                position:absolute;top:18px;right:22px;
                background:rgba(255,255,255,.2);border:none;
                border-radius:50%;width:48px;height:48px;
                font-size:28px;cursor:pointer;color:#fff;
            ">&times;</button>
            <div id="profileAvatar" style="
                width:64px;height:64px;border-radius:50%;
                background:rgba(255,255,255,.25);
                display:flex;align-items:center;justify-content:center;
                font-size:30px;color:#fff;font-weight:700;
                margin-bottom:10px;border:3px solid rgba(255,255,255,.5);
            ">?</div>
            <!-- Полное имя (Имя Фамилия) крупно -->
            <div id="profileFullName" style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px;word-break:break-word;line-height:1.3;">Гость</div>
            <!-- Никнейм/логин мелко -->
            <div id="profileLogin" style="font-size:16px;color:rgba(255,255,255,.75);"></div>
        </div>

        <!-- Редактирование ФИ -->
        <div style="padding:16px 24px 0;">
            <h3 style="font-size:20px;font-weight:700;color:#333;margin:0 0 10px;">Имя и Фамилия</h3>
            <input id="profileInputFirst" type="text" placeholder="Имя" style="
                width:100%;margin-bottom:8px;padding:10px 14px;font-size:20px;
                border:2px solid #e0e0e0;border-radius:6px;
                font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;
            ">
            <input id="profileInputLast" type="text" placeholder="Фамилия" style="
                width:100%;margin-bottom:10px;padding:10px 14px;font-size:20px;
                border:2px solid #e0e0e0;border-radius:6px;
                font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;
            ">
            <button id="profileSaveName" style="
                width:100%;padding:10px;border-radius:6px;
                border:none;background:linear-gradient(90deg,#2cff00,#0b3d06);
                color:#072307;font-size:20px;font-weight:700;cursor:pointer;
            ">Сохранить</button>
            <div id="profileSaveMsg" style="font-size:18px;color:#0b6600;text-align:center;min-height:20px;margin-top:6px;"></div>
        </div>

        <div style="padding:16px 24px 0;">
            <h3 style="font-size:20px;font-weight:700;color:#333;margin:0 0 14px;">Мои бронирования</h3>
            <div id="profileBookings" style="display:flex;flex-direction:column;gap:10px;">
                <div style="color:#aaa;font-size:18px;text-align:center;padding:14px 0;">Загрузка...</div>
            </div>
        </div>

        <div style="padding:16px 24px 0;">
            <button id="profileLogout" style="
                width:100%;padding:12px;border-radius:6px;
                border:2px solid #ff4444;background:#fff5f5;
                color:#cc0000;font-size:20px;font-weight:600;
                cursor:pointer;font-family:'Inter',sans-serif;transition:.15s;
            ">Выйти из аккаунта</button>
        </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("profileClose").addEventListener("click", closeProfilePanel);

    document.getElementById("profileLogout").addEventListener("click", () => {
        window.currentUser = null;
        ["userId","userName","userLogin","userFirstName","userLastName"].forEach(k => localStorage.removeItem(k));
        updateAuthButton();
        closeProfilePanel();
    });

    // Сохранение ФИ
    document.getElementById("profileSaveName").addEventListener("click", async () => {
        const first_name = document.getElementById("profileInputFirst").value.trim();
        const last_name  = document.getElementById("profileInputLast").value.trim();
        const msg        = document.getElementById("profileSaveMsg");

        if (!first_name && !last_name) { msg.textContent = "Введите имя или фамилию"; msg.style.color = "#c00"; return; }

        try {
            const res = await fetch(`/api/user/${window.currentUser.id}/name`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ first_name, last_name })
            });
            if (res.ok) {
                window.currentUser.first_name = first_name;
                window.currentUser.last_name  = last_name;
                localStorage.setItem("userFirstName", first_name);
                localStorage.setItem("userLastName",  last_name);

                // Обновляем шапку профиля
                const display = [first_name, last_name].filter(Boolean).join(" ");
                document.getElementById("profileFullName").textContent = display || window.currentUser.name;
                document.getElementById("profileAvatar").textContent   = (first_name || window.currentUser.name).charAt(0).toUpperCase();
                updateAuthButton();

                msg.style.color   = "#0b6600";
                msg.textContent   = "Сохранено ✓";
                setTimeout(() => { msg.textContent = ""; }, 2500);
            } else {
                msg.style.color = "#c00"; msg.textContent = "Ошибка сохранения";
            }
        } catch(e) {
            msg.style.color = "#c00"; msg.textContent = "Нет соединения";
        }
    });
}

function openProfilePanel() {
    if (!window.currentUser) { openAuthPanel(); return; }
    buildProfilePanel();

    const { name, first_name, last_name } = window.currentUser;
    const login    = localStorage.getItem("userLogin") || "";
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || name;

    document.getElementById("profileFullName").textContent  = fullName;
    document.getElementById("profileLogin").textContent     = login ? `@${login}` : (name !== fullName ? name : "");
    document.getElementById("profileAvatar").textContent    = (first_name || name).charAt(0).toUpperCase();
    document.getElementById("profileInputFirst").value      = first_name || "";
    document.getElementById("profileInputLast").value       = last_name  || "";
    document.getElementById("profileSaveMsg").textContent   = "";

    showOverlay("profileOverlay");
    const panel = document.getElementById("profilePanel");
    panel.style.display = "block";
    requestAnimationFrame(() => { panel.style.right = "0"; });

    loadProfileBookings();
}

function closeProfilePanel() {
    hideOverlay("profileOverlay");
    const panel = document.getElementById("profilePanel");
    if (panel) {
        panel.style.right = "-480px";
        setTimeout(() => { panel.style.display = "none"; }, 300);
    }
}

async function loadProfileBookings() {
    const container = document.getElementById("profileBookings");
    if (!container || !window.currentUser) return;
    try {
        const res = await fetch(`/api/bookings/user/${window.currentUser.id}`);
        if (res.ok) {
            const bookings = await res.json();
            renderProfileBookings(bookings, container);
        } else {
            container.innerHTML = `<div style="color:#aaa;font-size:22px;text-align:center;padding:20px 0;">Нет бронирований</div>`;
        }
    } catch(e) {
        container.innerHTML = `<div style="color:#aaa;font-size:22px;text-align:center;padding:20px 0;">Нет бронирований</div>`;
    }
}

function renderProfileBookings(bookings, container) {
    if (!bookings.length) {
        container.innerHTML = `<div style="color:#aaa;font-size:22px;text-align:center;padding:20px 0;">Нет бронирований</div>`;
        return;
    }
    container.innerHTML = bookings.map(b => `
        <div style="border:1px solid #e8e8e8;border-radius:14px;padding:18px 20px;background:#fafafa;">
            <div style="font-size:24px;font-weight:700;color:#222;margin-bottom:8px;">${b.hotelName || 'Отель'}</div>
            <div style="font-size:20px;color:#666;">${formatDateRU(b.checkin)} — ${formatDateRU(b.checkout)}</div>
        </div>
    `).join("");
}

// ═══════════════════════════════════════════════════════
//  ПРИВЯЗКА КНОПОК ШАПКИ
// ═══════════════════════════════════════════════════════
function bindHeaderButtons() {
    const locBlock = document.querySelector(".v4_2");
    if (locBlock) { locBlock.style.cursor = "pointer"; locBlock.addEventListener("click", openCityPanel); }

    const datesBlock = document.querySelector(".v4_3");
    if (datesBlock) { datesBlock.style.cursor = "pointer"; datesBlock.addEventListener("click", openCalPanel); }

    const guestsBlock = document.querySelector(".v4_4");
    if (guestsBlock) { guestsBlock.style.cursor = "pointer"; guestsBlock.addEventListener("click", openGuestsPanel); }

    const searchBtn = document.querySelector(".v4_11");
    if (searchBtn) {
        searchBtn.style.cursor = "pointer";
        searchBtn.addEventListener("click", async () => {
            saveSearchState();
            if (typeof loadHotelsBySearch === "function") {
                await loadHotelsBySearch();
            } else {
                window.location.href = "../intent.html";
            }
        });
    }

    const vhodDiv = document.querySelector(".vhod");
    if (vhodDiv) {
        vhodDiv.id = "vhodBtn";
        vhodDiv.style.cursor = "pointer";
        // Устанавливаем начальный текст с учётом ФИ
        if (window.currentUser) {
            const { first_name, last_name, name } = window.currentUser;
            const display = [first_name, last_name].filter(Boolean).join(" ") || name;
            const span = vhodDiv.querySelector(".v1_7");
            if (span) span.textContent = display;
        }
        vhodDiv.addEventListener("click", (e) => {
            e.stopPropagation();
            window.currentUser ? openProfilePanel() : openAuthPanel();
        });
    }

    const menuHome = document.querySelector(".menu-item");
    if (menuHome) {
        menuHome.style.cursor = "pointer";
        menuHome.addEventListener("click", (e) => {
            e.preventDefault();
            saveSearchState();
            window.location.href = window.location.href.includes("onehotel") ? "../intent.html" : "intent.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => { updateUI(); bindHeaderButtons(); });
if (document.readyState !== "loading") { updateUI(); bindHeaderButtons(); }

window.openAuthPanel    = openAuthPanel;
window.openProfilePanel = openProfilePanel;
window.setLoggedInUser  = setLoggedInUser;