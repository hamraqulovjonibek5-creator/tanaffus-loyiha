// ============================================================
// Tanaffus eslatuvchi — script.js (tuzatilgan versiya)
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

const DEFAULT_TITLE = 'Tanaffus eslatuvchi';

// ---------- Holat o'zgaruvchilari ----------
let mode = 'work';               // 'work' yoki 'break'
let isRunning = false;           // Taymer ishlayaptimi?
let endTime = null;              // Tugash vaqti (timestamp)
let remainingMs = 0;             // Pauza holatida qolgan vaqt (ms)
let workDurationMs = 120 * 60 * 1000;
let breakDurationMs = 10 * 60 * 1000;
let intervalId = null;           // zaxira setInterval identifikatori

// ---------- Kiritilgan daqiqani xavfsiz o'qish ----------
// Bo'sh, harf, 0 yoki manfiy son kiritilsa, standart qiymat olinadi.
function getMinutes(input, defaultValue) {
    const v = parseInt(input.value, 10);
    if (isNaN(v) || v < 1) return defaultValue;
    return Math.min(v, 1440); // eng ko'pi bilan 24 soat
}

// ============================================================
// OVOZ (alarm.mp3 kerak emas, ovozni brauzerning o'zi hosil qiladi)
// ============================================================
let audioCtx = null;
let alarmInterval = null;
let alarmTimeout = null;
let alarmPending = false; // ovoz hali ochilmagan, ochilishi bilan chalinadi

// Ovozni "ochib qo'yish". Chrome ovozga faqat foydalanuvchi bosgandan keyin ruxsat beradi.
function unlockAudio() {
    try {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            audioCtx = new AC();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                // Signal kutib turgan bo'lsa, endi chalamiz
                if (alarmPending && mode === 'break') playAlarm();
            }).catch(() => {});
        }
    } catch (e) {
        console.error('Ovozni ochishda xato:', e);
    }
}

// Sahifada birinchi bosish yoki tugma bosilganda ovozni ochamiz
// (sahifa yangilangandan keyin ham ovoz ishlashi uchun)
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

// Bitta "bip"
function beepOnce() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

// Signalni to'xtatish
function stopAlarm() {
    clearInterval(alarmInterval);
    clearTimeout(alarmTimeout);
    alarmInterval = null;
    alarmTimeout = null;
    alarmPending = false;
}

// Signalni boshlash: har 0.6 soniyada bip, 15 soniyadan keyin o'zi to'xtaydi
function playAlarm() {
    stopAlarm();
    unlockAudio();
    if (!audioCtx || audioCtx.state !== 'running') {
        alarmPending = true; // ovoz ochilishi bilan chalinadi
        return;
    }
    beepOnce();
    alarmInterval = setInterval(beepOnce, 600);
    alarmTimeout = setTimeout(stopAlarm, 15000);
}

// ============================================================
// BILDIRISHNOMA
// ============================================================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showNotification(title, body) {
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body });
        }
    } catch (e) {
        console.error('Bildirishnomada xato:', e);
    }
}

// ============================================================
// FON TIKERI
// Brauzer fondagi tabda setInterval'ni sekinlashtiradi (5 daqiqadan keyin
// minutiga 1 marta). Web Worker bunday cheklanmaydi, shuning uchun
// signal aniq vaqtida chiqadi.
// ============================================================
function createTicker() {
    try {
        const code =
            "let id=null;" +
            "onmessage=function(e){" +
            "if(e.data==='start'){clearInterval(id);id=setInterval(function(){postMessage('tick')},250);}" +
            "else if(e.data==='stop'){clearInterval(id);id=null;}" +
            "};";
        const blob = new Blob([code], { type: 'application/javascript' });
        const w = new Worker(URL.createObjectURL(blob));
        w.onmessage = tick;
        return w;
    } catch (e) {
        return null; // Worker ishlamasa, oddiy setInterval ishlatiladi
    }
}
const ticker = createTicker();

function startInterval() {
    stopInterval();
    if (ticker) {
        ticker.postMessage('start');
    } else {
        intervalId = setInterval(tick, 250);
    }
}

function stopInterval() {
    if (ticker) ticker.postMessage('stop');
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// Har 250 ms da chaqiriladi
function tick() {
    if (!isRunning) return;
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
        stopInterval();
        isRunning = false;
        if (mode === 'work') {
            onWorkEnd();
        } else {
            onBreakEnd();
        }
    } else {
        updateTimerDisplay();
    }
}

// Sahifaga qaytilganda ham darhol tekshirib qo'yamiz
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
});

// ---------- "Yopish" tugmasini yaratish va tanaffus ekraniga qo'shish ----------
const closeBtn = document.createElement('button');
closeBtn.id = 'closeBreakBtn';
closeBtn.textContent = 'Yopish';
closeBtn.style.marginTop = '30px';
closeBtn.style.padding = '15px 40px';
closeBtn.style.fontSize = '18px';
closeBtn.style.borderRadius = '10px';
closeBtn.style.border = 'none';
closeBtn.style.background = '#2563eb';
closeBtn.style.color = 'white';
closeBtn.style.fontWeight = 'bold';
breakScreen.appendChild(closeBtn);

// "Yopish" tugmasini yoqish yoki o'chirish
function setCloseBtn(enabled) {
    closeBtn.disabled = !enabled;
    closeBtn.style.opacity = enabled ? '1' : '0.5';
    closeBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
}
setCloseBtn(false);

closeBtn.addEventListener('click', () => {
    if (!closeBtn.disabled) {
        breakScreen.style.display = 'none';
        stopAlarm();
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

// ---------- Taymer ko'rinishini yangilash ----------
function updateTimerDisplay() {
    const remaining = isRunning ? endTime - Date.now() : remainingMs;
    const text = formatTime(remaining);
    if (mode === 'work') {
        workTimerEl.textContent = text;
        document.title = (isRunning ? 'Ish ' : 'Pauza ') + text;
    } else {
        breakTimerEl.textContent = text;
        document.title = 'Tanaffus ' + text;
    }
}

// ---------- Ish vaqti tugaganda ----------
function onWorkEnd() {
    workTimerEl.textContent = formatTime(0);

    // 1. Ovoz va bildirishnoma
    playAlarm();
    showNotification('Tanaffus vaqti!', 'Ish vaqti tugadi. Dam oling!');

    // 2. Tanaffus rejimiga o'tish
    mode = 'break';
    isRunning = true;
    breakDurationMs = getMinutes(breakTimeInput, 10) * 60 * 1000;
    endTime = Date.now() + breakDurationMs;
    remainingMs = breakDurationMs;

    // 3. Tanaffus ekranini ko'rsatish
    breakScreen.style.display = 'flex';
    setCloseBtn(false);
    breakScreen.querySelector('h1').textContent = 'TANAFFUS VAQTI!';
    breakScreen.querySelector('p').textContent = 'Bir oz dam oling va ko\u2018zlaringizni tinchlantiring!';

    updateTimerDisplay();
    startInterval();
    saveState();
}

// ---------- Tanaffus tugaganda ----------
function onBreakEnd() {
    stopAlarm();
    breakTimerEl.textContent = formatTime(0);
    setCloseBtn(true);

    breakScreen.querySelector('h1').textContent = 'TANAFFUS TUGADI!';
    breakScreen.querySelector('p').textContent = 'Ish vaqti avtomatik boshlandi. Yopish tugmasini bosing.';

    showNotification('Tanaffus tugadi', 'Ish vaqti avtomatik boshlandi.');

    // Ish taymerini avtomatik boshlash (tanaffus ekranini yopmasdan)
    startWorkTimer(true);
}

// ---------- Ish taymerini boshlash ----------
function startWorkTimer(auto = false) {
    mode = 'work';
    isRunning = true;
    workDurationMs = getMinutes(workTimeInput, 120) * 60 * 1000;
    endTime = Date.now() + workDurationMs;
    remainingMs = workDurationMs;

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
    if (mode === 'break') return; // tanaffus paytida pauza taqiqlangan

    isRunning = false;
    stopInterval();
    remainingMs = Math.max(0, endTime - Date.now());
    updateTimerDisplay();
    saveState();
}

// ---------- Reset qilish ----------
function resetTimer() {
    stopInterval();
    stopAlarm();
    isRunning = false;
    mode = 'work';
    workDurationMs = getMinutes(workTimeInput, 120) * 60 * 1000;
    remainingMs = workDurationMs;
    endTime = null;
    workTimerEl.textContent = formatTime(workDurationMs);
    document.title = DEFAULT_TITLE;

    breakScreen.style.display = 'none';
    setCloseBtn(false);
    saveState();
}

// ---------- Holatni localStorage ga saqlash ----------
function saveState() {
    try {
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
    } catch (e) {
        console.error('Saqlashda xato:', e);
    }
}

// ---------- Holatni localStorage dan yuklash ----------
function loadState() {
    let saved = null;
    try {
        saved = localStorage.getItem('tanaffusTimerState');
    } catch (e) {
        return false;
    }
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);
        mode = state.mode === 'break' ? 'break' : 'work';
        isRunning = !!state.isRunning;
        endTime = state.endTime || null;
        remainingMs = state.remainingMs || 0;
        workDurationMs = state.workDurationMs || (120 * 60 * 1000);
        breakDurationMs = state.breakDurationMs || (10 * 60 * 1000);

        if (state.workTimeInput) workTimeInput.value = state.workTimeInput;
        if (state.breakTimeInput) breakTimeInput.value = state.breakTimeInput;

        if (isRunning && endTime) {
            if (endTime - Date.now() <= 0) {
                // Sahifa yopiq paytda vaqt tugab bo'lgan
                isRunning = false;
                if (mode === 'work') {
                    onWorkEnd();
                } else {
                    onBreakEnd();
                }
            } else {
                // Hali vaqt bor, davom ettiramiz
                if (mode === 'break') {
                    breakScreen.style.display = 'flex';
                    setCloseBtn(false);
                } else {
                    breakScreen.style.display = 'none';
                }
                updateTimerDisplay();
                startInterval();
            }
        } else {
            // Pauza yoki to'xtatilgan holat
            if (mode === 'break') {
                breakScreen.style.display = 'flex';
                setCloseBtn(false);
            } else {
                breakScreen.style.display = 'none';
            }
            if (mode === 'work' && remainingMs <= 0) {
                return false; // buzilgan holat, boshidan boshlaymiz
            }
            updateTimerDisplay();
        }
        return true;
    } catch (e) {
        console.error('State yuklashda xatolik:', e);
        return false;
    }
}

// ---------- Boshlash tugmasi ----------
startBtn.addEventListener('click', () => {
    unlockAudio();                  // ovozni ochish (juda muhim)
    requestNotificationPermission();

    if (mode === 'break') return;   // tanaffus paytida boshlab bo'lmaydi
    if (isRunning) return;          // allaqachon ishlayapti

    // Pauzadan davom ettirish
    if (remainingMs > 0 && remainingMs < workDurationMs) {
        isRunning = true;
        endTime = Date.now() + remainingMs;
        updateTimerDisplay();
        startInterval();
        saveState();
    } else {
        startWorkTimer(false);
    }
});

// ---------- To'xtatish (pauza) tugmasi ----------
stopBtn.addEventListener('click', pauseTimer);

// ---------- Qayta boshlash tugmasi ----------
resetBtn.addEventListener('click', resetTimer);

// ---------- Input o'zgarganda vaqtni yangilash ----------
workTimeInput.addEventListener('change', () => {
    if (!isRunning && mode === 'work') {
        workDurationMs = getMinutes(workTimeInput, 120) * 60 * 1000;
        remainingMs = workDurationMs;
        workTimerEl.textContent = formatTime(workDurationMs);
        saveState();
    }
});

breakTimeInput.addEventListener('change', saveState);

// ---------- Sahifa yuklanganda holatni tiklash ----------
window.addEventListener('load', () => {
    if (!loadState()) {
        resetTimer();
    }
});

// ---------- Sahifa yopilishidan oldin holatni saqlash ----------
window.addEventListener('beforeunload', saveState);
