import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

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

const params = new URLSearchParams(window.location.search);
const userId = params.get("userId") || localStorage.getItem("shakthi_user_id");

function redirectToLogin() {
    localStorage.removeItem("shakthi_user_id");
    localStorage.removeItem("shakthi_logged_in");
    window.location.href = "/login.html";
}

if (!userId) {
    redirectToLogin();
}

localStorage.setItem("shakthi_user_id", userId);
localStorage.setItem("shakthi_logged_in", "true");

let currentUser = null;
let liveLocationWatcherId = null;
let latestLiveCoords = null;

const menuBtn = document.getElementById("menuBtn");
const infoBtn = document.getElementById("info");
const closeProfileBtn = document.getElementById("closeProfile");
const profileOverlay = document.getElementById("profileOverlay");
const profilePanel = document.getElementById("profilePanel");
const mapOverlay = document.getElementById("mapOverlay");
const liveMapPanel = document.getElementById("liveMapPanel");
const closeLiveMapBtn = document.getElementById("closeLiveMap");
const liveMapFrame = document.getElementById("liveMapFrame");
const liveMapStatus = document.getElementById("liveMapStatus");
const toastStack = document.getElementById("toastStack");
const emergencyShortcut = document.getElementById("emergencyShortcut");
const safetyTools = document.getElementById("safetyTools");
const liveMapTool = document.getElementById("liveMapTool");
const logoutBtn = document.getElementById("logoutBtn");

function showToast(title, message, tone = "info") {
    if (!toastStack) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2800);
}

function readValue(value, fallback = "Not added") {
    return value && String(value).trim() ? String(value).trim() : fallback;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
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
    const initials = fullName
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
        console.log('🔥 Firebase: Loading user profile for ID:', userId);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.warn('🔥 Firebase: User document not found:', userId);
            showToast("Profile Missing", "This user profile was not found in Firebase.", "error");
            setTimeout(() => redirectToLogin(), 600);
            return;
        }

        currentUser = { id: userSnap.id, ...userSnap.data() };
        console.log('✅ Firebase: User profile loaded:', currentUser.fullName);
        updateProfileUI(currentUser);
    } catch (error) {
        console.error('❌ Firebase ERROR (loadUserProfile):', error.code, error.message);
        if (error.code === 'permission-denied') {
            showToast("Access Denied", "Firebase rules block this read. Check console.", "error");
        } else {
            showToast("Firebase Load Failed", error.message, "error");
        }
        setTimeout(() => redirectToLogin(), 800);
    }
}

function openProfile() {
    document.body.classList.add("profile-open");
    profilePanel?.setAttribute("aria-hidden", "false");
}

function closeProfile() {
    document.body.classList.remove("profile-open");
    profilePanel?.setAttribute("aria-hidden", "true");
}

menuBtn?.addEventListener("click", openProfile);
closeProfileBtn?.addEventListener("click", closeProfile);
profileOverlay?.addEventListener("click", closeProfile);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeProfile();
    }
});

infoBtn?.addEventListener("click", () => {
    showToast("About SHAKTHI", "Emergency tools, profile details, and safety actions are all managed inside the app.", "info");
});

emergencyShortcut?.addEventListener("click", () => {
    if (!safetyTools) {
        return;
    }

    safetyTools.scrollIntoView({ behavior: "smooth", block: "start" });
    safetyTools.classList.add("shortcut-focus");
    showToast("Shortcut Opened", "You are now at the emergency tools section.", "info");

    setTimeout(() => {
        safetyTools.classList.remove("shortcut-focus");
    }, 1100);
});

function openLiveMapPanel(latitude, longitude, accuracy = null) {
    if (liveMapFrame) {
        liveMapFrame.src = `https://www.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`;
    }

    if (liveMapStatus) {
        const accuracyText = accuracy ? ` Accuracy: about ${Math.round(accuracy)} meters.` : "";
        liveMapStatus.textContent = `Showing your exact live location inside SHAKTHI.${accuracyText}`;
    }

    document.body.classList.add("map-open");
    liveMapPanel?.setAttribute("aria-hidden", "false");
}

function closeLiveMapPanel() {
    document.body.classList.remove("map-open");
    liveMapPanel?.setAttribute("aria-hidden", "true");
}

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
        async (position) => {
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
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}

closeLiveMapBtn?.addEventListener("click", closeLiveMapPanel);
mapOverlay?.addEventListener("click", closeLiveMapPanel);

logoutBtn?.addEventListener("click", () => {
    closeProfile();
    showToast("Logged Out", "Your SHAKTHI session has been cleared.", "info");
    setTimeout(() => {
        redirectToLogin();
    }, 300);
});

async function sendAlert(type, extraData = {}) {
    if (!currentUser) {
        await loadUserProfile();
    }

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
        console.log('🔥 Firebase: Sending', type, 'alert');
        await addDoc(collection(db, "alerts"), alertData);
        console.log('✅ Firebase: Alert sent successfully');
        return true;
    } catch (err) {
        console.error('❌ Firebase ERROR (sendAlert):', err.code, err.message);
        if (err.code === 'permission-denied') {
            showToast("Write Blocked", "Firebase rules deny alert writes. Check Rules tab.", "error");
        } else {
            showToast("Send Failed", `Error: ${err.message}`, "error");
        }
        return false;
    }
}

// New: Send Twilio SMS via Vercel API
async function sendTwilioSOS(lat, lon) {
    try {
        const response = await fetch('/api/send-sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Twilio SMS sent via Vercel API');
        return result.success;
    } catch (error) {
        console.error('❌ Twilio API failed:', error);
        showToast("SMS Failed", "SMS backup not sent", "warning");
        return false;
    }
}


document.querySelectorAll(".tool").forEach((tool, index) => {
    if (tool.classList.contains("empty")) {
        tool.addEventListener("click", () => {
            showToast("Coming Soon", "This feature section is ready for your next update.", "info");
        });
        return;
    }

    tool.addEventListener("click", async () => {
        const toolId = tool.id || `tool-${index + 1}`;

if (toolId === "sosTrigger") {
            // Get location first for SOS
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
            
            const sentFirebase = await sendAlert("sos", { 
                message: "🚨 CRITICAL SOS - Location + SMS sent via SHAKTHI App" 
            });
            
            let sentSMS = false;
            if (sosLocation.latitude && sosLocation.longitude) {
                sentSMS = await sendTwilioSOS(sosLocation.latitude, sosLocation.longitude);
            }
            
            if (sentFirebase || sentSMS) {
                showToast("✅ SOS CONFIRMED", "Firebase alert + SMS backup sent!", "success");
            } else {
                showToast("❌ SOS Failed", "Check internet + location permission", "error");
            }
        } else if (toolId === "liveMapTool") {
            await startLiveLocationTracking();
        } else if (toolId === "location") {
            const dangerMessage = `ALERT! ${currentUser?.fullName || "User"} IN DANGER`;
            const sent = await sendAlert("location", {
                message: dangerMessage,
                dangerAlert: true,
                targetAgency: "admin"
            });
            if (sent) {
                showToast("Danger Alert Sent", "Your location and danger alert were shared with admin.", "success");
            }
        } else if (toolId === "alarmTrigger") {
            playAlarmLocally();
            const sent = await sendAlert("alarm", { message: "Personal alarm activated" });
            if (sent) {
                showToast("Alarm Active", "Personal alarm confirmed from SHAKTHI App only.", "success");
            }
        } else if (toolId === "emergencyBtn") {
            const num = tool.getAttribute("data-number") || "123";
            const sent = await sendAlert("call", { message: `Automatic emergency call to ${num}` });
            if (sent) {
                showToast("Emergency Call", "Call request confirmed from SHAKTHI App only.", "success");
            }
            window.location.href = `tel:${num}`;
        } else {
            const sent = await sendAlert("general", { message: `Tool box ${index + 1} was interacted with` });
            if (sent) {
                showToast("Notification Sent", "This action was confirmed from SHAKTHI App only.", "success");
            }
        }
    });
});

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

loadUserProfile();
