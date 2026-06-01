const firebaseConfig = {
    apiKey: "AIzaSyAq2xi7wTiIcwtUuIqIbqVVbamp0NcZPW4",
    authDomain: "project-shakthi.firebaseapp.com",
    projectId: "project-shakthi",
    storageBucket: "project-shakthi.firebasestorage.app",
    messagingSenderId: "250758772501",
    appId: "1:250758772501:web:c1f294984e143a1f94db1c",
    measurementId: "G-B9D4WBTEKG"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const params = new URLSearchParams(window.location.search);
const userId = params.get("userId") || localStorage.getItem("shakthi_user_id");

function redirectToLogin() {
    localStorage.removeItem("shakthi_user_id");
    localStorage.removeItem("shakthi_logged_in");
    window.location.href = "/login.html";
}

if (!userId) redirectToLogin();

localStorage.setItem("shakthi_user_id", userId);
localStorage.setItem("shakthi_logged_in", "true");

let currentUser = null;
let liveLocationWatcherId = null;
let latestLiveCoords = null;
let deferredInstallPrompt = null;

const menuBtn = document.getElementById("menuBtn");
const infoBtn = document.getElementById("info");
const addShortcutBtn = document.getElementById("addShortcutBtn");
const closeProfileBtn = document.getElementById("closeProfile");
const profileOverlay = document.getElementById("profileOverlay");
const profilePanel = document.getElementById("profilePanel");
const mapOverlay = document.getElementById("mapOverlay");
const liveMapPanel = document.getElementById("liveMapPanel");
const closeLiveMapBtn = document.getElementById("closeLiveMap");
const liveMapContainer = document.getElementById("liveMapContainer");
const liveMapStatus = document.getElementById("liveMapStatus");
const toastStack = document.getElementById("toastStack");
const emergencyShortcut = document.getElementById("emergencyShortcut");
const safetyTools = document.getElementById("safetyTools");
const logoutBtn = document.getElementById("logoutBtn");

function showToast(title, message, tone = "info") {
    if (!toastStack) return;
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}

function readValue(value, fallback = "Not added") {
    return value && String(value).trim() ? String(value).trim() : fallback;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function updateProfileUI(user) {
    const fullName = readValue(user.fullName, "Shakthi User");
    const email = readValue(user.email, "yourmail@example.com");
    const phone = readValue(user.phone);
    const blood = readValue(user.bloodGroup);
    const emergency = readValue(user.emergencyContact);
    const address = readValue(user.address);
    const age = readValue(user.age, "");
    const gender = readValue(user.gender, "");
    const meta = [age, gender].filter(Boolean).join(" / ") || "Not added";
    const initials =
        fullName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join("") || "S";

    setText("profileName", fullName);
    setText("profileEmail", email);
    setText("profilePhone", phone);
    setText("profileBlood", blood);
    setText("profileEmergency", emergency);
    setText("profileAddress", address);
    setText("profileMeta", meta);
    setText("profileAvatar", initials);
}

async function loadUserProfile() {
    try {
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            showToast("Profile Missing", "This user profile was not found in Firebase.", "error");
            setTimeout(() => redirectToLogin(), 600);
            return;
        }

        currentUser = { id: userSnap.id, ...userSnap.data() };
        updateProfileUI(currentUser);
    } catch (error) {
        console.error("❌ Firebase ERROR (loadUserProfile):", error?.code, error?.message);
        if (error?.code === "permission-denied") {
            showToast("Access Denied", "Firebase rules block this read. Check console.", "error");
        } else {
            showToast("Firebase Load Failed", error?.message || "Unknown error", "error");
        }
        setTimeout(() => redirectToLogin(), 800);
    }
}

function openProfile() {
    document.body.classList.add("profile-open");
    profilePanel?.setAttribute("aria-hidden", "false");
    profileSetTab("alerts");
}

function closeProfile() {
    document.body.classList.remove("profile-open");
    profilePanel?.setAttribute("aria-hidden", "true");
}

menuBtn?.addEventListener("click", openProfile);
closeProfileBtn?.addEventListener("click", closeProfile);
profileOverlay?.addEventListener("click", closeProfile);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfile();
});

infoBtn?.addEventListener("click", () => {
    showToast(
        "About SHAKTHI",
        "Emergency tools, profile details, and safety actions are all managed inside the app.",
        "info"
    );
});

addShortcutBtn?.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice?.outcome === "accepted") {
            showToast("Shortcut created", "The app shortcut was added.", "success");
        } else {
            showToast("Shortcut not added", "You can try again from the top button.", "info");
        }
        deferredInstallPrompt = null;
        return;
    }

    showToast(
        "Add shortcut",
        "Use your browser menu and choose 'Add to Home screen' or 'Install app' to create a shortcut.",
        "info"
    );
});

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
});

emergencyShortcut?.addEventListener("click", () => {
    if (!safetyTools) return;
    safetyTools.scrollIntoView({ behavior: "smooth", block: "start" });
    safetyTools.classList.add("shortcut-focus");
    showToast("Shortcut Opened", "You are now at the emergency tools section.", "info");
    setTimeout(() => safetyTools.classList.remove("shortcut-focus"), 1100);
});

// ===== Leaflet Map =====
let _leafletMap = null;
let _leafletMarkers = [];

function initLeafletMap() {
    if (_leafletMap || typeof L === "undefined" || !liveMapContainer) return;
    _leafletMap = L.map(liveMapContainer, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(_leafletMap);
}

function clearLeafletMarkers() {
    if (!_leafletMap) return;
    _leafletMarkers.forEach((m) => _leafletMap.removeLayer(m));
    _leafletMarkers = [];
}

function toRad(deg) {
    return (deg * Math.PI) / 180;
}
function computeDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function showMarkersOnMap(stations, center) {
    initLeafletMap();
    if (!_leafletMap) return;
    clearLeafletMarkers();

    const bounds = [];
    stations.forEach((s) => {
        if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
        const marker = L.marker([s.lat, s.lon]).addTo(_leafletMap);
        const distLine = s.distance ? `<br/><small style="color:#666">${formatDistance(s.distance)}</small>` : "";
        const phoneLine = s.phone
            ? `<br/><a href="tel:${s.phone}">${s.phone}</a>`
            : '<br/><small style="color:#666">Phone: Not available</small>';
        marker.bindPopup(`<strong>${s.name}</strong>${phoneLine}${distLine}`);
        _leafletMarkers.push(marker);
        bounds.push([s.lat, s.lon]);
    });

    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
        _leafletMap.setView([center.lat, center.lon], 13);
    } else if (bounds.length) {
        _leafletMap.fitBounds(bounds, { padding: [40, 40] });
    }

    if (_leafletMarkers.length === 1) {
        try {
            _leafletMarkers[0].openPopup();
        } catch {}
    }
}

function openLiveMapPanel(latitudeOrStations, longitude = null, accuracy = null) {
    document.body.classList.add("map-open");
    liveMapPanel?.setAttribute("aria-hidden", "false");

    if (Array.isArray(latitudeOrStations)) {
        liveMapStatus.textContent = `Showing ${latitudeOrStations.length} nearby locations.`;
        showMarkersOnMap(latitudeOrStations, null);
        return;
    }

    const latitude = latitudeOrStations;
    const accuracyText = accuracy ? ` Accuracy: about ${Math.round(accuracy)} meters.` : "";
    if (liveMapStatus) liveMapStatus.textContent = `Showing your exact live location inside SHAKTHI.${accuracyText}`;

    const station = { lat: latitude, lon: longitude, name: "Location" };
    showMarkersOnMap([station], { lat: latitude, lon: longitude });
}

function closeLiveMapPanel() {
    document.body.classList.remove("map-open");
    liveMapPanel?.setAttribute("aria-hidden", "true");
}

closeLiveMapBtn?.addEventListener("click", closeLiveMapPanel);
mapOverlay?.addEventListener("click", closeLiveMapPanel);

// ===== Police panel (existing behavior preserved roughly) =====
let nearbyPoliceData = null;
const POLICE_RADIUS_METERS = 30000;
const POLICE_RADIUS_LABEL = "30 km";

function getStationLat(station) {
    return Number(station?.lat ?? station?.latitude);
}

function getStationLon(station) {
    return Number(station?.lon ?? station?.longitude ?? station?.lng);
}

function normalisePoliceStations(payload, origin) {
    const stations = Array.isArray(payload) ? payload : (Array.isArray(payload?.stations) ? payload.stations : []);
    return stations
        .map((station) => {
            const lat = getStationLat(station);
            const lon = getStationLon(station);
            const distance = Number.isFinite(Number(station?.distance))
                ? Number(station.distance)
                : (Number.isFinite(lat) && Number.isFinite(lon)
                    ? computeDistanceMeters(origin.latitude, origin.longitude, lat, lon)
                    : null);

            return {
                ...station,
                name: station?.name || station?.displayName || "Police Station",
                phone: station?.phone || station?.phoneNumber || null,
                address: station?.address || station?.vicinity || "",
                lat,
                lon,
                distance
            };
        })
        .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon))
        .filter((station) => !Number.isFinite(station.distance) || station.distance <= POLICE_RADIUS_METERS)
        .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTelHref(phone) {
    return String(phone ?? "").replace(/[^\d+*#]/g, "");
}

function showPoliceStationOnAppMap(index) {
    const station = nearbyPoliceData?.[index];
    if (!station || !Number.isFinite(station.lat) || !Number.isFinite(station.lon)) return;

    openLiveMapPanel([station]);
}

function renderPoliceStations(stations) {
    const list = document.getElementById("policeStationList");
    if (!list) return;

    if (!stations.length) {
        list.innerHTML = "";
        return;
    }

    list.innerHTML = stations.map((station, index) => {
        const distanceText = Number.isFinite(station.distance) ? `${formatDistance(station.distance)} away` : `Within ${POLICE_RADIUS_LABEL}`;
        const phoneText = station.phone ? escapeHtml(station.phone) : "Phone not available";
        const addressLine = station.address ? `<div>${escapeHtml(station.address)}</div>` : "";
        const telHref = formatTelHref(station.phone);
        const callAction = station.phone
            ? `<a class="police-mini-action" href="tel:${telHref}">Call</a>`
            : "";

        return `
            <article class="police-item">
                <strong>${index + 1}. ${escapeHtml(station.name)}</strong>
                <div>${phoneText} - ${escapeHtml(distanceText)}</div>
                ${addressLine}
                <div class="police-item-actions">
                    ${callAction}
                    <button class="police-mini-action secondary" type="button" data-police-map-index="${index}">Map</button>
                </div>
            </article>
        `;
    }).join("");
}

document.getElementById("policeStationList")?.addEventListener("click", (event) => {
    const mapButton = event.target.closest("[data-police-map-index]");
    if (!mapButton) return;

    const index = Number(mapButton.getAttribute("data-police-map-index"));
    showPoliceStationOnAppMap(index);
});

async function fetchAndShowNearbyPolice() {
    try {
        if (!("geolocation" in navigator)) {
            showToast("Location Unavailable", "This device does not support location access.", "error");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    const response = await fetch(`/api/nearby-police?lat=${latitude}&lon=${longitude}`);
                    if (!response.ok) throw new Error(`API error: ${response.status}`);
                    
                    const payload = await response.json();
                    const data = normalisePoliceStations(payload, { latitude, longitude });
                    nearbyPoliceData = data;
                    
                    if (data && data.length > 0) {
                        const station = data[0];
                        const name = data.length === 1 ? station.name : `${data.length} police stations found`;
                        const phone = station.phone || "N/A";
                        const distance = station.distance ? `${(station.distance / 1000).toFixed(1)} km away` : `Within ${POLICE_RADIUS_LABEL}`;
                        
                        document.getElementById("policeInfoTitle") && (document.getElementById("policeInfoTitle").textContent = name);
                        document.getElementById("policeInfoSub") && (document.getElementById("policeInfoSub").textContent = `Showing police stations around ${POLICE_RADIUS_LABEL}. Nearest: ${phone} - ${distance}`);
                        renderPoliceStations(data);
                        
                        // Setup call button
                        const callBtn = document.getElementById("policeCallBtn");
                        if (callBtn && phone && phone !== "N/A") {
                            callBtn.onclick = () => window.location.href = `tel:${phone}`;
                        }
                        
                        // Setup location button
                        const locBtn = document.getElementById("policeSeeLocationBtn");
                        if (locBtn && Number.isFinite(station.lat) && Number.isFinite(station.lon)) {
                            locBtn.onclick = () => {
                                openLiveMapPanel(data);
                            };
                        }
                    } else {
                        document.getElementById("policeInfoTitle") && (document.getElementById("policeInfoTitle").textContent = "No Police Nearby");
                        document.getElementById("policeInfoSub") && (document.getElementById("policeInfoSub").textContent = `No police stations found within ${POLICE_RADIUS_LABEL}.`);
                        renderPoliceStations([]);
                    }
                } catch (error) {
                    console.error("Police fetch error:", error);
                    document.getElementById("policeInfoSub") && (document.getElementById("policeInfoSub").textContent = "Failed to fetch police data. Please try again.");
                    renderPoliceStations([]);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                showToast("Location Error", "Could not access your location.", "error");
            }
        );
    } catch (error) {
        console.error("Police panel error:", error);
        showToast("Error", "Failed to open police panel.", "error");
    }
}

function showPoliceInfoPanel() {
    const policeInfoPanel = document.getElementById("policeInfoPanel");
    if (!policeInfoPanel) return;
    
    policeInfoPanel.style.display = "";
    policeInfoPanel.removeAttribute("inert");
    policeInfoPanel.removeAttribute("aria-hidden");
    renderPoliceStations([]);
    
    // Fetch police data when panel opens
    fetchAndShowNearbyPolice();
}

function hidePoliceInfoPanel() {
    const policeInfoPanel = document.getElementById("policeInfoPanel");
    const policeBtn = document.getElementById("policeBtn");
    if (!policeInfoPanel) return;

    const active = document.activeElement;
    if (active && policeInfoPanel.contains(active)) {
        policeBtn?.focus?.();
    }

    policeInfoPanel.setAttribute("inert", "");
    policeInfoPanel.setAttribute("aria-hidden", "true");
    policeInfoPanel.style.display = "none";
}

document.addEventListener("click", (e) => {
    const panel = document.getElementById("policeInfoPanel");
    const btn = document.getElementById("policeBtn");
    if (!panel) return;
    if (panel.getAttribute("aria-hidden") === "true") return;
    if (!panel.contains(e.target) && e.target !== btn && !(btn && btn.contains && btn.contains(e.target))) {
        hidePoliceInfoPanel();
    }
});

const _policePanelEl = document.getElementById("policeInfoPanel");
if (_policePanelEl) _policePanelEl.addEventListener("click", (ev) => ev.stopPropagation());

document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hidePoliceInfoPanel();
});

hidePoliceInfoPanel();

document.getElementById("closePoliceInfo")?.addEventListener("click", hidePoliceInfoPanel);

async function startLiveLocationTracking() {
    if (!("geolocation" in navigator)) {
        showToast("Live Map Unavailable", "This device does not support live location.", "error");
        return;
    }

    if (latestLiveCoords) {
        openLiveMapPanel(latestLiveCoords.latitude, latestLiveCoords.longitude, latestLiveCoords.accuracy);
        showToast("Live Map Opened", "Showing your exact live location inside the app.", "success");
        return;
    }

    if (liveLocationWatcherId !== null) {
        showToast("Live Tracking Active", "Waiting for your current location update.", "info");
        return;
    }

    showToast("Starting Live Map", "Fetching your live location from the app.", "info");

    liveLocationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            latestLiveCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            openLiveMapPanel(latestLiveCoords.latitude, latestLiveCoords.longitude, latestLiveCoords.accuracy);
            showToast("Live Map Ready", "Your exact live location is now open inside SHAKTHI.", "success");

            if (liveLocationWatcherId !== null) {
                navigator.geolocation.clearWatch(liveLocationWatcherId);
                liveLocationWatcherId = null;
            }
        },
        (error) => {
            console.error("Live map location error:", error);
            showToast("Live Map Failed", "Allow location permission to open the live map.", "error");

            if (liveLocationWatcherId !== null) {
                navigator.geolocation.clearWatch(liveLocationWatcherId);
                liveLocationWatcherId = null;
            }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

// ===== Alerts =====
async function sendAlert(type, extraData = {}) {
    if (!currentUser) await loadUserProfile();
    if (!currentUser) {
        showToast("Profile Required", "User data is not available from Firebase yet.", "error");
        return false;
    }

    let locationData = { latitude: null, longitude: null };
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
        };
    } catch (err) {
        console.warn("Could not fetch location for alert:", err.message);
    }

    const alertData = {
        type,
        userId: currentUser.id || userId,
        source: "user-app",
        sourceLabel: "SHAKTHI App (Vercel)",
        confirmedFromApp: true,
        userName: currentUser.fullName || "Unknown",
        userPhone: currentUser.phone || "N/A",
        ...currentUser,
        timestamp: new Date().toISOString(),
        resolved: false,
        ...locationData,
        ...extraData
    };

    try {
        await db.collection("alerts").add(alertData);
        return true;
    } catch (err) {
        console.error("sendAlert error:", err?.code, err?.message);
        showToast("Send Failed", err?.message || "Could not send alert", "error");
        return false;
    }
}

async function sendTwilioSOS(lat, lon) {
    try {
        const response = await fetch('/api/send-sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error("Twilio API failed:", error);
        showToast("SMS Failed", "SMS backup not sent", "warning");
        return false;
    }
}

function playAlarmLocally() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();

        let count = 0;
        const alarmInterval = setInterval(() => {
            const now = audioCtx.currentTime;
            oscillator.frequency.setValueAtTime(count % 2 === 0 ? 1200 : 600, now);
            count += 1;

            if (count > 20) {
                clearInterval(alarmInterval);
                gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                setTimeout(() => {
                    oscillator.stop();
                    audioCtx.close();
                }, 300);
            }
        }, 200);
    } catch (error) {
        console.warn("Audio error:", error);
    }
}

// ===== 5s Confirm Timer Modal =====
const confirmTimerOverlay = document.getElementById("confirmTimerOverlay");
const confirmTimerModal = document.getElementById("confirmTimerModal");
const confirmTimerTitle = document.getElementById("confirmTimerTitle");
const confirmTimerSub = document.getElementById("confirmTimerSub");
const confirmTimerCount = document.getElementById("confirmTimerCount");
const confirmTimerRing = document.getElementById("confirmTimerRing");
const confirmTimerCancel = document.getElementById("confirmTimerCancel");
const confirmTimerCancel2 = document.getElementById("confirmTimerCancel2");

let confirmTimerIntervalId = null;
let confirmTimerOnConfirm = null;
let confirmTimerRunning = false;

function closeConfirmTimerModal() {
    if (confirmTimerIntervalId) {
        clearInterval(confirmTimerIntervalId);
        confirmTimerIntervalId = null;
    }

    confirmTimerOnConfirm = null;
    confirmTimerRunning = false;

    confirmTimerModal?.setAttribute("aria-hidden", "true");
    confirmTimerOverlay?.classList.remove("active");
    confirmTimerModal?.classList.remove("active");
}


function openConfirmTimerModal({ title, sub, seconds = 5, onConfirm }) {
    if (!confirmTimerModal || !confirmTimerOverlay) return;
    if (confirmTimerRunning) return;

    confirmTimerRunning = true;
    confirmTimerOnConfirm = typeof onConfirm === "function" ? onConfirm : null;

    if (confirmTimerTitle) confirmTimerTitle.textContent = title || "Confirm Action";
    if (confirmTimerSub) confirmTimerSub.textContent = sub || "This action will be sent in";
    if (confirmTimerCount) confirmTimerCount.textContent = String(seconds);

    if (confirmTimerRing) {
        const r = Number(confirmTimerRing.getAttribute("r") || 48);
        const circumference = 2 * Math.PI * r;
        confirmTimerRing.style.strokeDasharray = String(circumference);
        confirmTimerRing.style.strokeDashoffset = String(circumference);
    }

    confirmTimerModal.setAttribute("aria-hidden", "false");
    confirmTimerOverlay.classList.add("active");
    confirmTimerModal.classList.add("active");

    (confirmTimerCancel2 || confirmTimerCancel)?.focus?.();

    const total = seconds;
    let remaining = seconds;

    if (confirmTimerIntervalId) clearInterval(confirmTimerIntervalId);

    confirmTimerIntervalId = setInterval(() => {
        remaining -= 1;
        if (confirmTimerCount) confirmTimerCount.textContent = String(Math.max(0, remaining));

        if (confirmTimerRing) {
            const r = Number(confirmTimerRing.getAttribute("r") || 48);
            const circumference = 2 * Math.PI * r;
            const elapsed = total - remaining;
            const progress = Math.min(1, Math.max(0, elapsed / total));
            const offset = circumference * (1 - progress);
            confirmTimerRing.style.strokeDashoffset = String(offset);
        }

        if (remaining <= 0) {
            clearInterval(confirmTimerIntervalId);
            confirmTimerIntervalId = null;

            const cb = confirmTimerOnConfirm;
            // mark closed first so Cancel / other handlers won't block or double-run
            closeConfirmTimerModal();

            // ensure exactly-once callback
            confirmTimerOnConfirm = null;
            confirmTimerRunning = false;
            cb && cb();
        }

    }, 1000);
}

confirmTimerCancel?.addEventListener("click", () => closeConfirmTimerModal());
confirmTimerCancel2?.addEventListener("click", () => closeConfirmTimerModal());

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && confirmTimerModal?.classList.contains("active")) {
        closeConfirmTimerModal();
    }
});

// ===== Public Review (Firestore + Map Pin + Feed) =====
const PUBLIC_REVIEW_COLLECTION = "public_reviews";
const PUBLIC_REVIEW_COMMENTS_COLLECTION = "comments";

let publicReviewPin = null; // { marker }
let publicReviewPinCoords = null; // { latitude, longitude }
let publicFeedUnsub = null;
let publicMapPickerActive = false;
let publicReviewUiReady = false;
let publicReviewMap = null;
let publicFeedMap = null;
let publicFeedMarkers = [];

const publicReviewPanel = document.getElementById("publicReviewPanel");
const publicReviewOverlay = document.getElementById("publicReviewOverlay");
const closePublicReviewBtn = document.getElementById("closePublicReview");

const pubTabCreate = document.getElementById("pubTabCreate");
const pubTabFeed = document.getElementById("pubTabFeed");
const pubCreatePanel = document.getElementById("pubCreatePanel");
const pubFeedPanel = document.getElementById("pubFeedPanel");

const pubPinSummary = document.getElementById("pubPinSummary");
const pubMapContainer = document.getElementById("pubMapContainer");
const pubFeedMapContainer = document.getElementById("pubFeedMapContainer");
const pubPlaceNameInput = document.getElementById("pubPlaceName");
const pubCommentTextarea = document.getElementById("pubComment");
const pubSafeBtn = document.getElementById("pubSafeBtn");
const pubNotSafeBtn = document.getElementById("pubNotSafeBtn");
const pubSubmitBtn = document.getElementById("pubSubmitBtn");
const pubSubmitStatus = document.getElementById("pubSubmitStatus");

const profileTabAlerts = document.getElementById("profileTabAlerts");
const profileTabReviews = document.getElementById("profileTabReviews");
const profileAlertsPanel = document.getElementById("profileAlertsPanel");
const profileReviewsPanel = document.getElementById("profileReviewsPanel");
const profileAlertsList = document.getElementById("profileAlertsList");
const profileReviewsList = document.getElementById("profileReviewsList");

let pubSafetyStatus = null; // "safe" | "not_safe"
let pubEditReviewId = null;

const pubCancelEditBtn = document.getElementById("pubCancelEditBtn");

function pubResetReviewForm() {
    pubEditReviewId = null;
    if (pubPlaceNameInput) pubPlaceNameInput.value = "";
    if (pubCommentTextarea) pubCommentTextarea.value = "";
    pubSafetyStatus = null;
    if (pubSafeBtn) {
        pubSafeBtn.dataset.active = "false";
        pubSafeBtn.setAttribute("aria-pressed", "false");
    }
    if (pubNotSafeBtn) {
        pubNotSafeBtn.dataset.active = "false";
        pubNotSafeBtn.setAttribute("aria-pressed", "false");
    }
    publicReviewPinCoords = null;
    if (publicReviewPin?.marker) {
        try {
            publicReviewPin.marker.remove();
        } catch (err) {
            console.warn("Failed to remove review pin marker", err);
        }
    }
    publicReviewPin = null;
    if (pubPinSummary) pubPinSummary.textContent = "No place selected.";
    if (pubCancelEditBtn) {
        pubCancelEditBtn.style.display = "none";
    }
    setPubSubmitState("idle");
    if (pubSubmitBtn) pubSubmitBtn.textContent = "Submit Review";
}

function pubBeginReviewEdit(review) {
    pubEditReviewId = review.id;
    if (pubPlaceNameInput) pubPlaceNameInput.value = review.placeName || "";
    pubSafetyStatus = review.safetyStatus || null;

    if (review.safetyStatus === "safe") {
        pubSafeBtn?.setAttribute("aria-pressed", "true");
        pubNotSafeBtn?.setAttribute("aria-pressed", "false");
        if (pubSafeBtn) pubSafeBtn.dataset.active = "true";
        if (pubNotSafeBtn) pubNotSafeBtn.dataset.active = "false";
    } else if (review.safetyStatus === "not_safe") {
        pubSafeBtn?.setAttribute("aria-pressed", "false");
        pubNotSafeBtn?.setAttribute("aria-pressed", "true");
        if (pubSafeBtn) pubSafeBtn.dataset.active = "false";
        if (pubNotSafeBtn) pubNotSafeBtn.dataset.active = "true";
    }

    const lat = Number(review.latitude);
    const lon = Number(review.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        publicReviewPinCoords = { latitude: lat, longitude: lon };
        if (publicReviewPin?.marker) {
            try {
                publicReviewPin.marker.remove();
            } catch {}
        }
        if (publicReviewMap) {
            const marker = L.marker([lat, lon]).addTo(publicReviewMap);
            marker.bindPopup("Selected place for review").openPopup();
            publicReviewPin = { marker };
            publicReviewMap.setView([lat, lon], 15);
        } else {
            pubEnsureMapPinPicker();
            setTimeout(() => {
                if (publicReviewMap && publicReviewPinCoords && !publicReviewPin?.marker) {
                    const marker = L.marker([lat, lon]).addTo(publicReviewMap);
                    marker.bindPopup("Selected place for review").openPopup();
                    publicReviewPin = { marker };
                    publicReviewMap.setView([lat, lon], 15);
                }
            }, 300);
        }
        if (pubPinSummary) pubPinSummary.textContent = `Selected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } else {
        if (pubPinSummary) pubPinSummary.textContent = "No place selected.";
    }

    if (pubCancelEditBtn) {
        pubCancelEditBtn.style.display = "inline-flex";
    }
    if (pubSubmitBtn) pubSubmitBtn.textContent = "Update Review";
    pubSetTab("create");
    pubSetOpen(true);
    setPubSubmitState("idle");
}

function profileSetTab(tab) {
    const alertsActive = tab === "alerts";
    const reviewsActive = tab === "reviews";

    profileTabAlerts?.classList.toggle("active", alertsActive);
    profileTabReviews?.classList.toggle("active", reviewsActive);

    profileAlertsPanel?.classList.toggle("active", alertsActive);
    profileReviewsPanel?.classList.toggle("active", reviewsActive);

    if (profileAlertsPanel) profileAlertsPanel.setAttribute("aria-hidden", alertsActive ? "false" : "true");
    if (profileReviewsPanel) profileReviewsPanel.setAttribute("aria-hidden", reviewsActive ? "false" : "true");

    profileTabAlerts?.setAttribute("aria-selected", alertsActive ? "true" : "false");
    profileTabReviews?.setAttribute("aria-selected", reviewsActive ? "true" : "false");

    if (alertsActive) {
        profileLoadAlerts();
    } else if (reviewsActive) {
        profileLoadReviews();
    }
}

async function profileLoadAlerts() {
    if (!profileAlertsList) return;
    if (!currentUser) await loadUserProfile();
    if (!currentUser) return;

    profileAlertsList.innerHTML = `<div class="profile-panel-empty">Loading alerts...</div>`;

    try {
        const alertsQuery = db.collection("alerts")
            .where("userId", "==", currentUser.id);
        const alertsSnap = await alertsQuery.get();
        const alerts = alertsSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (!alerts.length) {
            profileAlertsList.innerHTML = `<div class="profile-panel-empty">You have not sent any alerts yet.</div>`;
            return;
        }

        profileAlertsList.innerHTML = "";
        alerts.forEach((alert) => {
            const typeLabel = alert.type
                ? alert.type.replace(/(^|_)(\w)/g, (_, __, chr) => chr.toUpperCase()).replace(/_/g, " ")
                : "Unknown alert";
            const when = alert.timestamp ? new Date(alert.timestamp).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }) : "Unknown time";
            const extra = alert.message || alert.targetAgency ? `<span>${pubEscapeHtml(alert.message || alert.targetAgency || "")}</span>` : "";
            const location = alert.latitude && alert.longitude ? `<span>Location: ${Number(alert.latitude).toFixed(4)}, ${Number(alert.longitude).toFixed(4)}</span>` : "";
            const item = document.createElement("div");
            item.className = "profile-list-item";
            item.innerHTML = `
                <strong>${pubEscapeHtml(typeLabel)}</strong>
                <span>${when}</span>
                ${location}
                ${extra}
            `;
            profileAlertsList.appendChild(item);
        });
    } catch (err) {
        console.error("Failed to load profile alerts:", err);
        profileAlertsList.innerHTML = `<div class="profile-panel-empty">Could not load alerts.</div>`;
    }
}

async function profileLoadReviews() {
    if (!profileReviewsList) return;
    if (!currentUser) await loadUserProfile();
    if (!currentUser) return;

    profileReviewsList.innerHTML = `<div class="profile-panel-empty">Loading your reviews...</div>`;

    try {
        const reviewsQuery = db.collection(PUBLIC_REVIEW_COLLECTION)
            .where("userId", "==", currentUser.id);
        const reviewsSnap = await reviewsQuery.get();
        const reviews = reviewsSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (!reviews.length) {
            profileReviewsList.innerHTML = `<div class="profile-panel-empty">You have not posted any reviews yet.</div>`;
            return;
        }

        profileReviewsList.innerHTML = "";
        reviews.forEach((review) => {
            const status = review.safetyStatus === "safe" ? "Safe" : "Not Safe";
            const when = review.timestamp ? new Date(review.timestamp).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }) : "Unknown time";
            const item = document.createElement("div");
            item.className = "profile-list-item";
            item.innerHTML = `
                <strong>${pubEscapeHtml(review.placeName || "Unknown place")}</strong>
                <span>${pubEscapeHtml(status)} • ${when}</span>
                <span>${review.edited ? "Edited" : "Original"}</span>
                <button type="button">Edit</button>
            `;
            item.querySelector("button")?.addEventListener("click", () => pubBeginReviewEdit(review));
            profileReviewsList.appendChild(item);
        });
    } catch (err) {
        console.error("Failed to load profile reviews:", err);
        profileReviewsList.innerHTML = `<div class="profile-panel-empty">Could not load your reviews.</div>`;
    }
}

function pubSetOpen(open) {
    if (open) {
        document.body.classList.add("pub-open");
        publicReviewPanel?.setAttribute("aria-hidden", "false");
        publicReviewOverlay?.setAttribute("aria-hidden", "false");
    } else {
        document.body.classList.remove("pub-open");
        publicReviewPanel?.setAttribute("aria-hidden", "true");
        publicReviewOverlay?.setAttribute("aria-hidden", "true");
    }
}

function pubSetTab(tab) {
    const createActive = tab === "create";
    // When switching to feed, always (re)load so first open works
    if (!createActive) {
        pubLoadFeed();
        setTimeout(() => publicFeedMap?.invalidateSize(), 80);
    }

    pubTabCreate?.classList.toggle("active", createActive);
    pubTabFeed?.classList.toggle("active", !createActive);

    pubCreatePanel?.classList.toggle("active", createActive);
    pubFeedPanel?.classList.toggle("active", !createActive);

    pubTabCreate?.setAttribute("aria-selected", String(createActive));
    pubTabFeed?.setAttribute("aria-selected", String(!createActive));
}

function setPubSubmitState(state) {
    if (!pubSubmitBtn) return;

    if (state === "submitting") {
        pubSubmitBtn.disabled = true;
        pubSubmitBtn.textContent = "Submitting...";
        if (pubSubmitStatus) {
            pubSubmitStatus.textContent = "Submitting your review...";
            pubSubmitStatus.classList.remove("submitted");
        }
        return;
    }

    if (state === "submitted") {
        pubSubmitBtn.disabled = true;
        pubSubmitBtn.textContent = "Submitted";
        if (pubSubmitStatus) {
            pubSubmitStatus.textContent = "Submitted. Your review is visible to all users.";
            pubSubmitStatus.classList.add("submitted");
        }
        return;
    }

    pubSubmitBtn.disabled = false;
    pubSubmitBtn.textContent = "Submit Review";
    if (pubSubmitStatus) {
        pubSubmitStatus.textContent = "Your review will be visible to all users.";
        pubSubmitStatus.classList.remove("submitted");
    }
}

function pubEscapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function pubInitUI() {
    if (!publicReviewPanel) return;
    if (publicReviewUiReady) return;
    publicReviewUiReady = true;

    closePublicReviewBtn?.addEventListener("click", () => pubSetOpen(false));
    publicReviewOverlay?.addEventListener("click", () => pubSetOpen(false));

    pubTabCreate?.addEventListener("click", () => pubSetTab("create"));
    pubTabFeed?.addEventListener("click", () => pubSetTab("feed"));

    pubSafeBtn?.addEventListener("click", () => {
        pubSafetyStatus = "safe";
        pubSafeBtn?.setAttribute("aria-pressed", "true");
        pubNotSafeBtn?.setAttribute("aria-pressed", "false");
        if (pubSafeBtn) pubSafeBtn.dataset.active = "true";
        if (pubNotSafeBtn) pubNotSafeBtn.dataset.active = "false";
        setPubSubmitState("idle");
    });

    pubNotSafeBtn?.addEventListener("click", () => {
        pubSafetyStatus = "not_safe";
        pubSafeBtn?.setAttribute("aria-pressed", "false");
        pubNotSafeBtn?.setAttribute("aria-pressed", "true");
        if (pubSafeBtn) pubSafeBtn.dataset.active = "false";
        if (pubNotSafeBtn) pubNotSafeBtn.dataset.active = "true";
        setPubSubmitState("idle");
    });

    pubCancelEditBtn?.addEventListener("click", () => pubResetReviewForm());

    pubSubmitBtn?.addEventListener("click", async () => {
        if (pubSubmitBtn.disabled) return;

        if (!publicReviewPinCoords) {
            showToast("Pick a place", "Tap on the map to select a location.", "warning");
            return;
        }

        const placeName = (pubPlaceNameInput?.value || "").trim();
        if (!placeName) {
            showToast("Place name required", "Enter a place name to submit your review.", "warning");
            return;
        }

        if (!pubSafetyStatus) {
            showToast("Select Safety", "Choose Safe or Not Safe.", "warning");
            return;
        }

        const comment = (pubCommentTextarea?.value || "").trim();
        const isEditing = Boolean(pubEditReviewId);

        try {
            setPubSubmitState("submitting");
            showToast(isEditing ? "Updating review" : "Submitting review", "Please wait...", "info");

            if (isEditing) {
                const reviewRef = db.collection(PUBLIC_REVIEW_COLLECTION).doc(pubEditReviewId);
                await reviewRef.update({
                    placeName,
                    latitude: publicReviewPinCoords.latitude,
                    longitude: publicReviewPinCoords.longitude,
                    safetyStatus: pubSafetyStatus,
                    timestamp: new Date().toISOString(),
                    edited: true
                });
            } else {
                const docRef = await db.collection(PUBLIC_REVIEW_COLLECTION).add({
                    placeName,
                    latitude: publicReviewPinCoords.latitude,
                    longitude: publicReviewPinCoords.longitude,
                    safetyStatus: pubSafetyStatus,
                    userId: currentUser?.id || userId,
                    userName: currentUser?.fullName || "Unknown",
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
                pubEditReviewId = docRef.id;
            }

            if (comment) {
                await db.collection(`${PUBLIC_REVIEW_COLLECTION}/${pubEditReviewId}/${PUBLIC_REVIEW_COMMENTS_COLLECTION}`)
                    .add({
                        userId: currentUser?.id || userId,
                        userName: currentUser?.fullName || "Unknown",
                        text: comment,
                        timestamp: new Date().toISOString()
                    });
            }

            showToast(isEditing ? "Review Updated" : "Review Submitted", isEditing ? "Your review has been updated." : "Thanks! Your feedback is visible to all users.", "success");
            setPubSubmitState("submitted");

            pubResetReviewForm();
            pubSetTab("feed");
            pubLoadFeed();
            setTimeout(() => setPubSubmitState("idle"), 2200);
        } catch (e) {
            console.error("Public review submit failed:", e);
            showToast("Submit Failed", e?.message || "Could not submit review", "error");
            setPubSubmitState("idle");
        }
    });
}

function pubEnsureMapPinPicker() {
    if (typeof L === "undefined" || !pubMapContainer) return;

    if (!publicReviewMap) {
        publicReviewMap = L.map(pubMapContainer, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(publicReviewMap);
    }

    const center = latestLiveCoords
        ? [latestLiveCoords.latitude, latestLiveCoords.longitude]
        : [13.63709, 74.68891];
    publicReviewMap.setView(center, 15);
    setTimeout(() => publicReviewMap?.invalidateSize(), 80);

    if (publicMapPickerActive) return;
    publicMapPickerActive = true;

    publicReviewMap.on("click", (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        publicReviewPinCoords = { latitude: lat, longitude: lon };
        if (pubPinSummary) pubPinSummary.textContent = `Selected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

        if (publicReviewPin?.marker) {
            try {
                publicReviewPin.marker.setLatLng([lat, lon]);
            } catch {}
        } else {
            const marker = L.marker([lat, lon]).addTo(publicReviewMap);
            marker.bindPopup("Selected place for review").openPopup();
            publicReviewPin = { marker };
        }
    });
}

function pubEnsureFeedMap() {
    if (typeof L === "undefined" || !pubFeedMapContainer) return null;

    if (!publicFeedMap) {
        publicFeedMap = L.map(pubFeedMapContainer, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(publicFeedMap);
    }

    setTimeout(() => publicFeedMap?.invalidateSize(), 80);
    return publicFeedMap;
}

function pubClearFeedMarkers() {
    if (!publicFeedMap) return;
    publicFeedMarkers.forEach((marker) => publicFeedMap.removeLayer(marker));
    publicFeedMarkers = [];
}

function pubUpdateFeedMap(reviews) {
    const map = pubEnsureFeedMap();
    if (!map) return;

    pubClearFeedMarkers();
    const bounds = [];

    reviews.forEach((review) => {
        const lat = Number(review.latitude);
        const lon = Number(review.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const marker = L.marker([lat, lon]).addTo(map);
        const status = review.safetyStatus === "safe" ? "Safe" : "Not Safe";
        marker.bindPopup(`<strong>${pubEscapeHtml(review.placeName || "Unknown place")}</strong><br>${status}`);
        publicFeedMarkers.push(marker);
        bounds.push([lat, lon]);
    });

    if (bounds.length) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    } else {
        map.setView([13.63709, 74.68891], 13);
    }
}

function pubLoadFeed() {
    const feedList = document.getElementById("pubFeedList");
    if (!feedList) return;

    if (!feedList) return;

    if (publicFeedUnsub) {
        try {
            publicFeedUnsub();
        } catch {}
        publicFeedUnsub = null;
    }

    feedList.innerHTML = `<div class="pub-review-card">Loading reviews...</div>`;

    try {
        const q = db.collection(PUBLIC_REVIEW_COLLECTION)
            .orderBy("timestamp", "desc")
            .limit(20);

        publicFeedUnsub = q.onSnapshot(async (snap) => {
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            pubUpdateFeedMap(docs);

            if (!docs.length) {
                feedList.innerHTML = `<div class="pub-review-card">No public reviews yet.</div>`;
                return;
            }

            feedList.innerHTML = "";

            for (const r of docs) {
                // Ensure comments are rendered even on first load
                const commentsEl = document.getElementById(`pubComments-${r.id}`);
                if (commentsEl) commentsEl.innerHTML = "";

                const badgeClass = r.safetyStatus === "safe" ? "safe" : "not_safe";
                const badgeLabel = r.safetyStatus === "safe" ? "Safe" : "Not Safe";

                const isOwner = r.userId === (currentUser?.id || userId);
                const el = document.createElement("div");
                el.className = "pub-review-card";
                el.innerHTML = `
                    <div class="pub-review-top">
                        <div>
                            <div class="pub-review-place">${pubEscapeHtml(r.placeName || "Unknown place")}</div>
                            <div style="margin-top:6px" class="pub-badge ${badgeClass}">${badgeLabel}</div>
                        </div>
                        <div class="pub-review-top-actions">
                            <div class="pub-review-meta">${new Date(r.timestamp).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}</div>
                            ${isOwner ? `<button class="pub-review-edit" id="pubEdit-${r.id}">Edit</button>` : ""}
                        </div>
                    </div>
                    <div class="pub-review-meta">By: ${pubEscapeHtml(r.userName || "Unknown")}</div>
                    <div class="pub-comments" id="pubComments-${r.id}"></div>
                    <div class="pub-comment-row">
                        <input class="pub-comment-input" id="pubComment-${r.id}" type="text" placeholder="Write a comment... (optional)" maxlength="200" />
                        <button class="pub-comment-post" id="pubPost-${r.id}">Post</button>
                    </div>
                `;
                feedList.appendChild(el);

                if (isOwner) {
                    document.getElementById(`pubEdit-${r.id}`)?.addEventListener("click", () => pubBeginReviewEdit(r));
                }

                // load recent comments
                try {
                    const commentsSnap = await db.collection(`${PUBLIC_REVIEW_COLLECTION}/${r.id}/${PUBLIC_REVIEW_COMMENTS_COLLECTION}`)
                        .orderBy("timestamp", "desc")
                        .limit(5)
                        .get();
                    const comments = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    const commentsEl = document.getElementById(`pubComments-${r.id}`);

                    if (commentsEl) {
                        commentsEl.innerHTML = comments.length
                            ? comments
                                .slice(0, 3)
                                .map(
                                    (c) => `
                                    <div class="pub-comment">
                                        <strong>${pubEscapeHtml(c.userName || "Unknown")}</strong>
                                        <p>${pubEscapeHtml(c.text || "")}</p>
                                    </div>
                                `
                                )
                                .join("")
                            : `<div class="pub-sub">No comments yet.</div>`;
                    }
                } catch {}

                // post comment
                document.getElementById(`pubPost-${r.id}`)?.addEventListener("click", async () => {
                    const input = document.getElementById(`pubComment-${r.id}`);
                    const text = (input?.value || "").trim();
                    if (!text) return;

                    try {
                        await db.collection(`${PUBLIC_REVIEW_COLLECTION}/${r.id}/${PUBLIC_REVIEW_COMMENTS_COLLECTION}`)
                            .add({
                                userId: currentUser?.id || userId,
                                userName: currentUser?.fullName || "Unknown",
                                text,
                                timestamp: new Date().toISOString()
                            });
                        if (input) input.value = "";
                    } catch (err) {
                        console.error("Comment post failed", err);
                        showToast("Comment Failed", err?.message || "Could not post", "error");
                    }
                });
            }
        });
    } catch (err) {
        console.error("pubLoadFeed failed:", err);
        showToast("Feed Error", "Could not load public reviews.", "error");
    }
}

function openPublicReview() {
    pubInitUI();
    setPubSubmitState("idle");
    pubSetOpen(true);
    pubSetTab("create");

    if (latestLiveCoords) {
        pubEnsureMapPinPicker();
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    latestLiveCoords = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                    pubEnsureMapPinPicker();
                },
                () => pubEnsureMapPinPicker(),
                { timeout: 5000 }
            );
        } else {
            pubEnsureMapPinPicker();
        }
    }

    setTimeout(() => publicReviewMap?.invalidateSize(), 80);
}

// ===== Tool click handling =====
document.querySelectorAll(".tool").forEach((tool, index) => {
    if (tool.classList.contains("empty")) {
        tool.addEventListener("click", () => showToast("Coming Soon", "This feature section is ready for your next update.", "info"));
        return;
    }

    tool.addEventListener("click", async () => {
        const toolId = tool.id || `tool-${index + 1}`;

        if (toolId === "sosTrigger") {
            openConfirmTimerModal({
                title: "Confirm SOS",
                sub: "SOS will be sent in",
                seconds: 5,
                onConfirm: async () => {
                    let sosLocation = { latitude: null, longitude: null };
                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
                        });
                        sosLocation = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        };
                    } catch (err) {
                        console.warn("SOS location unavailable:", err.message);
                    }

                    showToast("🚨 EMERGENCY SOS", "Sending alert + SMS...", "error");

                    // Pass the exact SOS coordinates used for SMS so admin always gets the same location.
                    const sentFirebase = await sendAlert("sos", {
                        message: "🚨 CRITICAL SOS - Location + Alets sended to Police",
                        latitude: sosLocation.latitude,
                        longitude: sosLocation.longitude
                    });

                    let sentSMS = false;
                    if (sosLocation.latitude && sosLocation.longitude) {
                        sentSMS = await sendTwilioSOS(sosLocation.latitude, sosLocation.longitude);
                    }

                    if (sentFirebase || sentSMS) showToast("✅ SOS CONFIRMED", "Firebase alert + SMS backup sent!", "success");
                    else showToast("❌ SOS Failed", "Check internet + location permission", "error");
                }
            });
            return;
        }

        if (toolId === "location") {
            openConfirmTimerModal({
                title: "Confirm Location Alert",
                sub: "Location alert will be sent in",
                seconds: 5,
                onConfirm: async () => {
                    const dangerMessage = `ALERT! ${currentUser?.fullName || "User"} IN DANGER`;
                    const sent = await sendAlert("location", {
                        message: dangerMessage,
                        dangerAlert: true,
                        targetAgency: "admin"
                    });
                    if (sent) showToast("Danger Alert Sent", "Your location and danger alert were shared with admin.", "success");
                }
            });
            return;
        }

        if (toolId === "alarmTrigger") {
            openConfirmTimerModal({
                title: "Confirm Alarm",
                sub: "Alarm will be sent in",
                seconds: 5,
                onConfirm: async () => {
                    playAlarmLocally();
                    const sent = await sendAlert("alarm", { message: "Personal alarm activated", targetAgency: "admin" });
                    if (sent) showToast("Alarm Active", "Personal alarm confirmed from SHAKTHI App only.", "success");
                }
            });
            return;
        }

        if (toolId === "emergencyBtn") {
            const num = tool.getAttribute("data-number") || "123";
            openConfirmTimerModal({
                title: "Confirm Emergency Call",
                sub: "Call request will be sent in",
                seconds: 5,
                onConfirm: async () => {
                    const sent = await sendAlert("call", { message: `Automatic emergency call to ${num}`, targetAgency: "admin" });
                    if (sent) showToast("Emergency Call", "Call request confirmed from SHAKTHI App only.", "success");
                    window.location.href = `tel:${num}`;
                }
            });
            return;
        }

        if (toolId === "liveMapTool") {
            await startLiveLocationTracking();
            return;
        }

        if (toolId === "publicReviewBtn") {
            openPublicReview();
            return;
        }

        if (toolId === "policeBtn") {
            // Keep existing behavior minimal (fetching uses your prior code in older file).
            // For now, open the police panel; detailed implementation remains in your original file.
            const policeInfoPanel = document.getElementById("policeInfoPanel");
            if (!policeInfoPanel) return;

            if (policeInfoPanel.getAttribute("aria-hidden") === "false") {
                hidePoliceInfoPanel();
                return;
            }

            showPoliceInfoPanel();
            document.getElementById("policeInfoTitle") && (document.getElementById("policeInfoTitle").textContent = "Nearby Police");
            document.getElementById("policeInfoSub") && (document.getElementById("policeInfoSub").textContent = `Fetching police details within ${POLICE_RADIUS_LABEL}...`);
            return;
        }
    });
});

// logout
logoutBtn?.addEventListener("click", () => {
    closeProfile();
    showToast("Logged Out", "Your SHAKTHI session has been cleared.", "info");
    setTimeout(() => redirectToLogin(), 300);
});

// init (UI only)
pubInitUI();

function initProfileTabs() {
    if (profileTabAlerts) profileTabAlerts.addEventListener("click", () => profileSetTab("alerts"));
    if (profileTabReviews) profileTabReviews.addEventListener("click", () => profileSetTab("reviews"));
}

initProfileTabs();
profileSetTab("alerts");

loadUserProfile();
