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

let sirenAudio = null;
let sirenPlaying = false;
let initialLoadComplete = false;
let audioContext = null;

const seenAlertIds = new Set();
const toastStack = document.getElementById("toastStack");
const logoutBtn = document.getElementById("btnAdminLogout");

// Request notification permission
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function showToast(title, message, tone = "info") {
    if (!toastStack) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3200);
}

function createSiren() {
    try {
        if (!audioContext || audioContext.state === "closed") {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        let isPlaying = true;

        function sirenCycle() {
            if (!isPlaying || audioContext.state === "closed") return;
            
            const now = audioContext.currentTime;
            oscillator.frequency.linearRampToValueAtTime(1200, now + 0.5);
            oscillator.frequency.linearRampToValueAtTime(600, now + 1.0);
        }

        oscillator.start();
        sirenCycle();
        const sirenInterval = setInterval(() => {
            if (isPlaying) sirenCycle();
        }, 1000);

        return {
            stop() {
                isPlaying = false;
                clearInterval(sirenInterval);
                gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
                setTimeout(() => {
                    try {
                        oscillator.stop();
                    } catch (e) {
                        // Already stopped
                    }
                }, 200);
            }
        };
    } catch (error) {
        console.log("Siren creation error:", error);
        return { stop: () => {} };
    }
}

function playSiren() {
    if (sirenPlaying) {
        return;
    }

    try {
        sirenAudio = createSiren();
        sirenPlaying = true;
        document.getElementById("btnSilence")?.classList.add("active");
        document.getElementById("sosFlash")?.classList.add("active");
        
        // Change tab title to show alert
        document.title = "🚨 ALERT - SHAKTHI Admin";
    } catch (error) {
        console.log("Siren playback error:", error);
    }
}

function sendBrowserNotification(title, options = {}) {
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, {
                icon: "🛡️",
                badge: "🛡️",
                requireInteraction: true,
                ...options
            });
        } catch (error) {
            console.log("Notification error:", error);
        }
    }
}

function silenceSiren() {
    if (sirenAudio) {
        sirenAudio.stop();
        sirenAudio = null;
    }

    sirenPlaying = false;
    document.getElementById("btnSilence")?.classList.remove("active");
    document.getElementById("sosFlash")?.classList.remove("active");
    
    // Restore tab title
    document.title = "SHAKTHI - Admin Dashboard";
}

function showSOSModal(alert) {
    const modalTitle = document.getElementById("sosModalTitle");
    const userDisplay = document.getElementById("sosUserInfo");
    const detailsDisplay = document.getElementById("sosDetails");
    const respondBtn = document.getElementById("btnRespond");
    const modal = document.getElementById("sosModal");

    const typeLabel = alert.type === "location"
        ? "LOCATION ALERT"
        : alert.type === "sos"
            ? "SOS EMERGENCY"
            : alert.type === "alarm"
                ? "ALARM ALERT"
                : alert.type === "call"
                    ? "CALL ALERT"
                    : alert.type === "live_map"
                        ? "LIVE MAP ALERT"
                        : "NEW NOTIFICATION";

    if (modalTitle) {
        modalTitle.textContent = `${typeLabel}`;
    }

    if (userDisplay) {
        userDisplay.textContent = alert.userName || "Unknown User";
    }

    const details = [
        `Phone: ${alert.userPhone || "N/A"}`,
        `Time: ${new Date(alert.timestamp).toLocaleString("en-IN")}`,
        `Source: ${alert.sourceLabel || "SHAKTHI App"}`,
        `Target: ${alert.targetAgency || "admin"}`,
        `${alert.message || "Alert received"}`
    ].join("\n");

    if (detailsDisplay) {
        detailsDisplay.textContent = details;
    }

    if (respondBtn) {
        if (alert.latitude && alert.longitude) {
            respondBtn.setAttribute("href", `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`);
            respondBtn.style.display = "inline-flex";
        } else {
            respondBtn.style.display = "none";
        }
    }

    modal?.classList.add("active");
}

document.getElementById("btnSilence")?.addEventListener("click", silenceSiren);
document.getElementById("btnDismiss")?.addEventListener("click", () => {
    document.getElementById("sosModal")?.classList.remove("active");
    silenceSiren();
});

/* ===== All Alerts Popup ===== */
const ahModal = document.getElementById("alertsHistoryModal");
const ahBody = document.getElementById("alertsHistoryBody");
const ahCount = document.getElementById("alertsHistoryCount");
const ahLoading = document.getElementById("alertsHistoryLoading");
const btnAllAlerts = document.getElementById("btnAllAlerts");
const btnCloseAH = document.getElementById("btnCloseAlertsHistory");

let allAlertDocs = [];

function openAlertsHistory() {
    ahModal?.classList.add("active");
    ahModal?.setAttribute("aria-hidden", "false");
    if (allAlertDocs.length === 0) {
        loadAllAlerts();
    } else {
        renderAllAlerts("all");
    }
}

function closeAlertsHistory() {
    ahModal?.classList.remove("active");
    ahModal?.setAttribute("aria-hidden", "true");
}

btnAllAlerts?.addEventListener("click", openAlertsHistory);
btnCloseAH?.addEventListener("click", closeAlertsHistory);
ahModal?.addEventListener("click", (e) => {
    if (e.target === ahModal) closeAlertsHistory();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ahModal?.classList.contains("active")) {
        closeAlertsHistory();
    }
});

async function loadAllAlerts() {
    if (!ahBody || !ahLoading) return;
    ahLoading.style.display = "flex";
    ahBody.querySelectorAll(".ah-alert-row").forEach(r => r.remove());

    try {
        const { collection, getDocs, orderBy } = await import(
            "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js"
        );
        const snap = await getDocs(
            query(collection(db, "alerts"), orderBy("timestamp", "desc"))
        );
        allAlertDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        ahLoading.style.display = "none";

        // Show btnAllAlerts once data is loaded
        btnAllAlerts?.classList.add("visible");
        renderAllAlerts("all");
    } catch (err) {
        console.error("Failed to load all alerts:", err);
        ahLoading.style.display = "none";
        ahBody.innerHTML = `<div class="ah-empty"><div class="ah-empty-icon">⚠️</div><p>Failed to load alerts.</p></div>`;
        ahCount.textContent = "Error loading alerts";
    }
}

function renderAllAlerts(filter) {
    if (!ahBody) return;
    ahBody.querySelectorAll(".ah-alert-row").forEach(r => r.remove());

    const filtered = filter === "all"
        ? allAlertDocs
        : allAlertDocs.filter(a => (a.type || "") === filter);

    if (filtered.length === 0) {
        ahBody.innerHTML = `<div class="ah-empty"><div class="ah-empty-icon">🔕</div><p>No alerts found for this filter.</p></div>`;
        ahCount.textContent = "0 alerts loaded";
        return;
    }

    const icons = { sos: "🚨", location: "📍", alarm: "🔔", call: "📞", live_map: "🗺️" };
    const labels = { sos: "SOS EMERGENCY", location: "LOCATION SHARED", alarm: "ALARM TRIGGERED", call: "EMERGENCY CALL", live_map: "LIVE MAP TO POLICE" };

    const frag = document.createDocumentFragment();
    filtered.forEach(alert => {
        const type = alert.type || "sos";
        const row = document.createElement("div");
        const mapExtra = (alert.latitude && alert.longitude)
            ? `<span class="ah-agency">📍 ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}</span>`
            : ``;

        row.className = `ah-alert-row ah-${type}`;
        row.innerHTML = `
            <div class="ah-icon">${icons[type] || "⚠️"}</div>
            <div class="ah-info">
                <div class="ah-type">${labels[type] || "ALERT"}</div>
                <div class="ah-user">${escapeHtml(alert.userName || "Unknown")}</div>
                <div class="ah-meta">📱 ${escapeHtml(alert.userPhone || "N/A")} &nbsp; ${escapeHtml(alert.message || "No message")}</div>
                ${mapExtra}
            </div>
            <div class="ah-time">${new Date(alert.timestamp).toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            })}</div>
        `;
        frag.appendChild(row);
    });
    ahBody.appendChild(frag);
    ahCount.textContent = `${filtered.length} alert${filtered.length !== 1 ? "s" : ""} loaded`;
}

/* Filter buttons */
document.querySelectorAll("#alertsHistoryModal .filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("#alertsHistoryModal .filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderAllAlerts(btn.dataset.filter || "all");
    });
});

logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    window.location.href = "/admin/login.html";
});

const alertsRef = query(collection(db, "alerts"), where("confirmedFromApp", "==", true));

onSnapshot(alertsRef, (snapshot) => {
    const alertList = document.getElementById("alertList");
    if (!alertList) {
        return;
    }

    alertList.innerHTML = "";

    let totalAlerts = 0;
    let sosCount = 0;
    let locationCount = 0;

    const icons = {
        sos: "🚨",
        location: "📍",
        alarm: "🔔",
        call: "📞",
        live_map: "🗺️"
    };

    const labels = {
        sos: "SOS EMERGENCY",
        location: "LOCATION SHARED",
        alarm: "ALARM TRIGGERED",
        call: "EMERGENCY CALL",
        live_map: "LIVE MAP TO POLICE"
    };

    const changedAlerts = snapshot.docChanges()
        .filter(change => change.type === "added" || change.type === "modified")
        .map(change => ({ id: change.doc.id, ...change.doc.data(), changeType: change.type }));

    if (snapshot.empty) {
        alertList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔕</div>
                <p>No active alerts - all clear</p>
            </div>`;
    }

    const docs = [];
    snapshot.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
    docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    docs.forEach((alert) => {
        totalAlerts += 1;
        if (alert.type === "sos") {
            sosCount += 1;
        }
        if (alert.type === "location" || alert.type === "live_map") {
            locationCount += 1;
        }

        const timeStr = new Date(alert.timestamp).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit"
        });

        let locationBtn = "";
        if (alert.latitude && alert.longitude) {
            const mapUrl = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
            locationBtn = `<div class="alert-actions"><a class="btn-map" href="${mapUrl}" target="_blank">📍 Map</a></div>`;
        }

        const targetText = alert.targetAgency ? ` · ${escapeHtml(alert.targetAgency.toUpperCase())}` : "";

        const div = document.createElement("div");
        div.className = `alert-item ${alert.type || "sos"}`;
        div.innerHTML = `
            <div class="alert-icon">${icons[alert.type] || "⚠️"}</div>
            <div class="alert-info">
                <div class="alert-type">${labels[alert.type] || "ALERT"}${targetText}</div>
                <div class="alert-user">${escapeHtml(alert.userName)}</div>
                <div class="alert-details">📱 ${escapeHtml(alert.userPhone)} · ${escapeHtml(alert.message)}</div>
                <div class="alert-details">✅ Source: ${escapeHtml(alert.sourceLabel || "SHAKTHI App")}</div>
            </div>
            <div class="alert-time">${timeStr}</div>
            ${locationBtn}
        `;
        alertList.appendChild(div);

        seenAlertIds.add(alert.id);
    });

    if (initialLoadComplete && changedAlerts.length > 0) {
        const latestChange = changedAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        playSiren();
        showSOSModal(latestChange);

        const adminAlertMessage = latestChange.type === "location"
            ? `ALERT! ${latestChange.userName || "User"} IN DANGER`
            : `${latestChange.userName || "Unknown user"} sent a confirmed ${labels[latestChange.type] || "alert"} notification.`;

        showToast(
            latestChange.type === "location" ? "Danger Alert" : "Updated Alert",
            adminAlertMessage,
            latestChange.type === "sos" || latestChange.type === "location" ? "error" : "info"
        );

        const notificationTitle = latestChange.type === "location"
            ? `🚨 DANGER: ${latestChange.userName || "User"}`
            : `🔔 ${labels[latestChange.type] || "ALERT"} from ${latestChange.userName}`;
        const notificationOptions = {
            body: `${latestChange.message}\n📱 ${latestChange.userPhone}`,
            tag: `alert-${latestChange.id}`,
            renotify: true,
        };
        sendBrowserNotification(notificationTitle, notificationOptions);
    }

    initialLoadComplete = true;
    document.getElementById("statAlerts").textContent = totalAlerts;
    document.getElementById("statSOS").textContent = sosCount;
    document.getElementById("statLocation").textContent = locationCount;
    document.getElementById("alertCount").textContent = totalAlerts;
}, (error) => {
    console.error("Alerts listener error:", error);
    showToast("Alert Sync Error", "The admin panel could not read confirmed app alerts.", "error");
});

const usersRef = collection(db, "users");

onSnapshot(usersRef, (snapshot) => {
    const tbody = document.getElementById("usersBody");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 32px;">No users registered yet</td></tr>`;
    }

    snapshot.forEach((docSnap) => {
        const user = docSnap.data();
        const date = new Date(user.registeredAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(user.fullName)}</td>
            <td>${escapeHtml(user.phone)}</td>
            <td>${user.age || "-"}</td>
            <td>${escapeHtml(user.gender || "-")}</td>
            <td>${escapeHtml(user.bloodGroup || "-")}</td>
            <td>${escapeHtml(user.emergencyContact || "-")}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("statUsers").textContent = snapshot.size;
    document.getElementById("userCount").textContent = snapshot.size;
}, (error) => {
    console.error("Users listener error:", error);
    showToast("User Sync Error", "The admin panel could not refresh the users list.", "error");
});
