// ============================================================
// Tanaffus eslatuvchi — script.js
// Barcha funksiyalar o‘zbekcha izohlar bilan yozilgan.
// ============================================================

// ---------- DOM elementlarini olish ----------
const workTimerEl = document.getElementById('workTimer');
const breakTimerEl = document.getElementById('breakTimer');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const workTimeInput = document.getElementById('workTime');
const breakTimeInput = document.getElementById('breakTime');
const breakScreen = document.getElementById('breakScreen');

// ---------- Ovoz fayli ----------
const alarmSound = new Audio('alarm.mp3');

// ---------- Holat o‘zgaruvchilari ----------
let mode = 'work';               // 'work' yoki 'break'
let isRunning = false;           // Taymer ishlayaptimi?
let endTime = null;              // Tugash vaqti (timestamp)
let remainingMs = 0;             // Pauza holatida qolgan vaqt (ms)
let workDurationMs = 120 * 60 * 1000;  // Sukut bo‘yicha 120 daqiqa
let breakDurationMs = 10 * 60 * 1000;  // Sukut bo‘yicha 10 daqiqa
let intervalId = null;           // setInterval identifikatori

// ---------- "Yopish" tugmasini yaratish va tanaffus ekraniga qo‘shish ----------
const closeBtn = document.createElement('button');
closeBtn.id = 'closeBreakBtn';
closeBtn.textContent = 'Yopish';
closeBtn.style.marginTop = '30px';
closeBtn.style.padding = '15px 40px';
closeBtn.style.fontSize = '18px';
closeBtn.style.borderRadius = '10px';
closeBtn.style.border = 'none';
closeBtn.style.cursor = 'pointer';
closeBtn.style.background = '#2563eb';
closeBtn.style.color = 'white';
closeBtn.style.fontWeight = 'bold';
closeBtn.disabled = true;
closeBtn.style.opacity = '0.5';
closeBtn.style.cursor = 'not-allowed';
breakScreen.appendChild(closeBtn);

// Yopish tugmasi bosilganda tanaffus ekranini yashirish
closeBtn.addEventListener('click', () => {
    if (!closeBtn.disabled) {
        breakScreen.style.display = 'none';
        // Ovozni to‘xtatish
        alarmSound.pause();
        alarmSound.currentTime = 0;
    }
});

// ---------- Vaqtni HH:MM:SS formatida chiqarish ----------
function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---------- Taymer ko‘rinishini yangilash ----------
function updateTimerDisplay() {
    if (mode === 'work') {
        let remaining;
        if (isRunning) {
            remaining = endTime - Date.now();
        } else {
            remaining = remainingMs;
        }
        workTimerEl.textContent = formatTime(remaining);
    } else if (mode === 'break') {
        let remaining;
        if (isRunning) {
            remaining = endTime - Date.now();
        } else {
            remaining = remainingMs;
        }
        breakTimerEl.textContent = formatTime(remaining);
    }
}

// ---------- Intervalni to‘xtatish ----------
function stopInterval() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// ---------- Intervalni ishga tushirish ----------
function startInterval() {
    stopInterval();
    intervalId = setInterval(() => {
        if (!isRunning) return;
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
            // Vaqt tugadi
            stopInterval();
            isRunning = false;
            if (mode === 'work') {
                onWorkEnd();
            } else if (mode === 'break') {
                onBreakEnd();
            }
        } else {
            updateTimerDisplay();
        }
    }, 250); // Har 250 ms da tekshiramiz (fonda ham aniq ishlaydi)
}

// ---------- Ish vaqti tugaganda bajariladigan funksiya ----------
function onWorkEnd() {
    // 1. Ovozni chalish
    alarmSound.play().catch(e => console.log('Ovoz chalishda xatolik:', e));

    // 2. Brauzer bildirishnomasi yuborish
    if (Notification.permission === 'granted') {
        new Notification('Tanaffus vaqti!', {
            body: 'Ish vaqti tugadi. Dam oling!',
            icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('Tanaffus vaqti!', {
                    body: 'Ish vaqti tugadi. Dam oling!'
                });
            }
        });
    }

    // 3. Tanaffus rejimiga o‘tish
    mode = 'break';
    isRunning = true;

    // Tanaffus davomiyligini inputdan olish
    const breakMinutes = parseInt(breakTimeInput.value) || 10;
    breakDurationMs = breakMinutes * 60 * 1000;
    endTime = Date.now() + breakDurationMs;
    remainingMs = breakDurationMs;

    // 4. Tanaffus ekranini ko‘rsatish
    breakScreen.style.display = 'flex';
    closeBtn.disabled = true;
    closeBtn.style.opacity = '0.5';
    closeBtn.style.cursor = 'not-allowed';

    // Sarlavha va matnni yangilash
    breakScreen.querySelector('h1').textContent = 'TANAFFUS VAQTI!';
    breakScreen.querySelector('p').textContent = 'Bir oz dam oling va ko‘zlaringizni tinchlantiring!';

    // 5. Tanaffus taymerini yangilash va intervalni boshlash
    updateTimerDisplay();
    startInterval();
    saveState();
}

// ---------- Tanaffus tugaganda bajariladigan funksiya ----------
function onBreakEnd() {
    // Ovozni to‘xtatish
    alarmSound.pause();
    alarmSound.currentTime = 0;

    // Yopish tugmasini faollashtirish
    closeBtn.disabled = false;
    closeBtn.style.opacity = '1';
    closeBtn.style.cursor = 'pointer';

    // Xabarni o‘zgartirish
    breakScreen.querySelector('h1').textContent = 'TANAFFUS TUGADI!';
    breakScreen.querySelector('p').textContent = 'Ish vaqti avtomatik boshlandi. Yopish tugmasini bosing.';

    // Avtomatik ish taymerini boshlash (break ekranini yopmasdan)
    startWorkTimer(true);
}

// ---------- Ish taymerini boshlash ----------
function startWorkTimer(auto = false) {
    mode = 'work';
    isRunning = true;

    // Ish vaqtini inputdan olish
    const workMinutes = parseInt(workTimeInput.value) || 120;
    workDurationMs = workMinutes * 60 * 1000;
    endTime = Date.now() + workDurationMs;
    remainingMs = workDurationMs;

    // Agar qo‘lda boshlangan bo‘lsa, tanaffus ekranini yashirish
    if (!auto) {
        breakScreen.style.display = 'none';
    }

    updateTimerDisplay();
    startInterval();
    saveState();
}

// ---------- Pauza qilish ----------
function pauseTimer() {
    if (!isRunning) return;
    // Tanaffus paytida pauza qilish taqiqlanadi
    if (mode === 'break') return;

    isRunning = false;
    stopInterval();
    remainingMs = endTime - Date.now();
    if (remainingMs < 0) remainingMs = 0;
    updateTimerDisplay();
    saveState();
}

// ---------- Reset qilish ----------
function resetTimer() {
    stopInterval();
    isRunning = false;
    mode = 'work';

    // Inputdan vaqtni olish
    const workMinutes = parseInt(workTimeInput.value) || 120;
    workDurationMs = workMinutes * 60 * 1000;
    remainingMs = workDurationMs;
    endTime = null;
    workTimerEl.textContent = formatTime(workDurationMs);

    // Tanaffus ekranini yashirish
    breakScreen.style.display = 'none';

    // Ovozni to‘xtatish
    alarmSound.pause();
    alarmSound.currentTime = 0;

    // Yopish tugmasini bloklash
    closeBtn.disabled = true;
    closeBtn.style.opacity = '0.5';
    closeBtn.style.cursor = 'not-allowed';

    saveState();
}

// ---------- Holatni localStorage ga saqlash ----------
function saveState() {
    const state = {
        mode,
        isRunning,
        endTime,
        remainingMs,
        workDurationMs,
        breakDurationMs,
        workTimeInput: workTimeInput.value,
        breakTimeInput: breakTimeInput.value
    };
    localStorage.setItem('tanaffusTimerState', JSON.stringify(state));
}

// ---------- Holatni localStorage dan yuklash ----------
function loadState() {
    const saved = localStorage.getItem('tanaffusTimerState');
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        mode = state.mode || 'work';
        isRunning = state.isRunning || false;
        endTime = state.endTime || null;
        remainingMs = state.remainingMs || 0;
        workDurationMs = state.workDurationMs || (120 * 60 * 1000);
        breakDurationMs = state.breakDurationMs || (10 * 60 * 1000);

        // Input qiymatlarini tiklash
        if (state.workTimeInput) workTimeInput.value = state.workTimeInput;
        if (state.breakTimeInput) breakTimeInput.value = state.breakTimeInput;

        if (isRunning && endTime) {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                // Vaqt allaqachon tugagan
                isRunning = false;
                if (mode === 'work') {
                    mode = 'work';
                    onWorkEnd();
                } else if (mode === 'break') {
                    onBreakEnd();
                }
                return true;
            } else {
                // Hali vaqt bor — taymerni davom ettiramiz
                updateTimerDisplay();
                startInterval();

                // Agar tanaffus rejimida bo‘lsa, ekranni ko‘rsatish
                if (mode === 'break') {
                    breakScreen.style.display = 'flex';
                    closeBtn.disabled = true;
                    closeBtn.style.opacity = '0.5';
                    closeBtn.style.cursor = 'not-allowed';
                } else {
                    breakScreen.style.display = 'none';
                }
                return true;
            }
        } else {
            // Pauza holatida yoki to‘xtatilgan
            updateTimerDisplay();
            if (mode === 'break') {
                breakScreen.style.display = 'flex';
                closeBtn.disabled = true;
            } else {
                breakScreen.style.display = 'none';
            }
            return true;
        }
    } catch (e) {
        console.error('State yuklashda xatolik:', e);
        return false;
    }
}

// ---------- Boshlash tugmasi ----------
startBtn.addEventListener('click', () => {
    // Bildirishnoma ruxsatini so‘rash (agar hali so‘ralmagan bo‘lsa)
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Tanaffus paytida ish taymerini boshlash mumkin emas
    if (mode === 'break') return;

    // Agar allaqachon ishlayotgan bo‘lsa, hech narsa qilmaymiz
    if (isRunning) return;

    // Agar pauzadan qaytayotgan bo‘lsak
    if (remainingMs > 0 && remainingMs < workDurationMs) {
        isRunning = true;
        endTime = Date.now() + remainingMs;
        startInterval();
        saveState();
    } else {
        // Yangi ish taymerini boshlash
        startWorkTimer(false);
    }
});

// ---------- To‘xtatish (pauza) tugmasi ----------
stopBtn.addEventListener('click', () => {
    pauseTimer();
});

// ---------- Qayta boshlash tugmasi ----------
resetBtn.addEventListener('click', () => {
    resetTimer();
});

// ---------- Input o‘zgarganda vaqtni yangilash ----------
workTimeInput.addEventListener('change', () => {
    if (!isRunning && mode === 'work') {
        const minutes = parseInt(workTimeInput.value) || 120;
        workDurationMs = minutes * 60 * 1000;
        remainingMs = workDurationMs;
        workTimerEl.textContent = formatTime(workDurationMs);
        saveState();
    }
});

breakTimeInput.addEventListener('change', () => {
    // Faqat keyingi tanaffus uchun ishlatiladi
    saveState();
});

// ---------- Sahifa yuklanganda holatni tiklash ----------
window.addEventListener('load', () => {
    const loaded = loadState();
    if (!loaded) {
        // Boshlang‘ich holat
        resetTimer();
    }
});

// ---------- Sahifa yopilishidan oldin holatni saqlash ----------
window.addEventListener('beforeunload', () => {
    saveState();
});