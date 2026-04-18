/* ===== SHAKTHI ADMIN - JS ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const ADMIN_SESSION_KEY = "shakthi_admin_logged_in";
const ADMIN_USER_KEY = "shakthi_admin_user";

if (localStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
    window.location.href = "/admin/login.html";
}

const firebaseConfig = {
    apiKey: "AIzaSyAq2xi7wTiIcwtUuIqIbqVVbamp0NcZPW4",
    authDomain: "project-shakthi.firebaseapp.com",
    projectId: "project-shakthi",
    storageBucket: "project-shakthi.firebasestorage.app",
    messagingSenderId: "250758772501",
    appId: "1:250758772501:web:c1f294984e143a1f94db1c",
    measurementId: "G-B9D4WBTEKG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Siren (Web Audio API) =====
let sirenAudio = null;
let sirenPlaying = false;

function createSiren() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    function sirenCycle() {
        const now = audioCtx.currentTime;
        oscillator.frequency.linearRampToValueAtTime(1200, now + 0.5);
        oscillator.frequency.linearRampToValueAtTime(600, now + 1.0);
    }

    oscillator.start();
    sirenCycle();
    const sirenInterval = setInterval(sirenCycle, 1000);

    return {
        stop: function() {
            clearInterval(sirenInterval);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, 200);
        }
    };
}

function playSiren() {
    if (sirenPlaying) return;
    try {
        sirenAudio = createSiren();
        sirenPlaying = true;
        const silenceBtn = document.getElementById('btnSilence');
        const flashOverlay = document.getElementById('sosFlash');
        if (silenceBtn) silenceBtn.classList.add('active');
        if (flashOverlay) flashOverlay.classList.add('active');
    } catch (e) {
        console.log('Audio autoplay blocked:', e);
    }
}

function silenceSiren() {
    if (sirenAudio) {
        sirenAudio.stop();
        sirenAudio = null;
    }
    sirenPlaying = false;
    const silenceBtn = document.getElementById('btnSilence');
    const flashOverlay = document.getElementById('sosFlash');
    if (silenceBtn) silenceBtn.classList.remove('active');
    if (flashOverlay) flashOverlay.classList.remove('active');
}

document.getElementById('btnSilence')?.addEventListener('click', silenceSiren);
document.getElementById('btnDismiss')?.addEventListener('click', () => {
    document.getElementById('sosModal')?.classList.remove('active');
    silenceSiren();
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ===== Track IDs and Initial Load =====
let initialLoadComplete = false;
const seenAlertIds = new Set();
const toastStack = document.getElementById('toastStack');
const logoutBtn = document.getElementById('btnAdminLogout');

function showToast(title, message, tone = 'info') {
    if (!toastStack) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3200);
}

logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    window.location.href = "/admin/login.html";
});

// ===== Real-time listener: ALERTS collection =====
console.log('Initializing Alerts listener...');
const alertsRef = query(collection(db, 'alerts'), where('confirmedFromApp', '==', true));

onSnapshot(alertsRef, (snapshot) => {
    console.log('Alerts snapshot received! Size:', snapshot.size);
    const alertList = document.getElementById('alertList');
    if (!alertList) return;
    alertList.innerHTML = '';

    let totalAlerts = 0;
    let sosCount = 0;
    let locationCount = 0;

    const icons = { sos: '🚨', location: '📍', alarm: '🔔', call: '📞' };
    const labels = { sos: 'SOS EMERGENCY', location: 'LOCATION SHARED', alarm: 'ALARM TRIGGERED', call: 'EMERGENCY CALL' };

    if (snapshot.empty) {
        alertList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔕</div>
                <p>No active alerts — all clear</p>
            </div>`;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    docs.forEach((alert) => {
        totalAlerts++;
        if (alert.type === 'sos') sosCount++;
        if (alert.type === 'location') locationCount++;

        const timeStr = new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        let locationBtn = '';
        if (alert.latitude && alert.longitude) {
            const mapUrl = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
            locationBtn = `<div class="alert-actions"><a class="btn-map" href="${mapUrl}" target="_blank">📍 Map</a></div>`;
        }

        const div = document.createElement('div');
        div.className = `alert-item ${alert.type || 'sos'}`;
        div.innerHTML = `
            <div class="alert-icon">${icons[alert.type] || '⚠️'}</div>
            <div class="alert-info">
                <div class="alert-type">${labels[alert.type] || 'ALERT'}</div>
                <div class="alert-user">${escapeHtml(alert.userName)}</div>
                <div class="alert-details">📱 ${escapeHtml(alert.userPhone)} · ${escapeHtml(alert.message)}</div>
                <div class="alert-details">✅ Source: ${escapeHtml(alert.sourceLabel || 'SHAKTHI App')}</div>
            </div>
            <div class="alert-time">${timeStr}</div>
            ${locationBtn}
        `;
        alertList.appendChild(div);

        if (initialLoadComplete && !seenAlertIds.has(alert.id)) {
            playSiren();
            showSOSModal(alert);
            showToast(
                'New App Alert',
                `${alert.userName || 'Unknown user'} sent a confirmed notification from SHAKTHI App only.`,
                alert.type === 'sos' ? 'error' : 'info'
            );
        }
        seenAlertIds.add(alert.id);
    });

    initialLoadComplete = true;
    document.getElementById('statAlerts').textContent = totalAlerts;
    document.getElementById('statSOS').textContent = sosCount;
    document.getElementById('statLocation').textContent = locationCount;
    document.getElementById('alertCount').textContent = totalAlerts;
}, (error) => {
    console.error('Alerts listener error:', error);
    showToast('Alert Sync Error', 'The admin panel could not read confirmed app alerts.', 'error');
});

// ===== Real-time listener: USERS collection =====
console.log('Initializing Users listener...');
const usersRef = collection(db, 'users');

onSnapshot(usersRef, (snapshot) => {
    console.log('Users snapshot received! Size:', snapshot.size);
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 32px;">No users registered yet</td></tr>`;
    }

    snapshot.forEach((doc) => {
        const user = doc.data();
        const date = new Date(user.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(user.fullName)}</td>
            <td>${escapeHtml(user.phone)}</td>
            <td>${user.age || '—'}</td>
            <td>${escapeHtml(user.gender || '—')}</td>
            <td>${escapeHtml(user.bloodGroup || '—')}</td>
            <td>${escapeHtml(user.emergencyContact || '—')}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statUsers').textContent = snapshot.size;
    document.getElementById('userCount').textContent = snapshot.size;
}, (error) => {
    console.error('Users listener error:', error);
    showToast('User Sync Error', 'The admin panel could not refresh the users list.', 'error');
});

function showSOSModal(alert) {
    const userDisplay = document.getElementById('sosUserInfo');
    const detailsDisplay = document.getElementById('sosDetails');
    const respondBtn = document.getElementById('btnRespond');
    const modal = document.getElementById('sosModal');

    if (userDisplay) userDisplay.textContent = alert.userName || 'Unknown User';
    let details = `📱 Phone: ${alert.userPhone || 'N/A'}\n⏰ Time: ${new Date(alert.timestamp).toLocaleString('en-IN')}\n✅ Source: ${alert.sourceLabel || 'SHAKTHI App'}\n💬 ${alert.message}`;
    if (detailsDisplay) detailsDisplay.textContent = details;
    
    if (respondBtn) {
        if (alert.latitude && alert.longitude) {
            respondBtn.setAttribute('href', `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`);
            respondBtn.style.display = 'inline-flex';
        } else {
            respondBtn.style.display = 'none';
        }
    }
    
    modal?.classList.add('active');
}
