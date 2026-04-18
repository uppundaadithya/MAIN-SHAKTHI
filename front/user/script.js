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
    window.location.href = "/login/login.html";
}

if (!userId) {
    redirectToLogin();
}

localStorage.setItem("shakthi_user_id", userId);
localStorage.setItem("shakthi_logged_in", "true");

let currentUser = null;

const menuBtn = document.getElementById("menuBtn");
const infoBtn = document.getElementById("info");
const closeProfileBtn = document.getElementById("closeProfile");
const profileOverlay = document.getElementById("profileOverlay");
const profilePanel = document.getElementById("profilePanel");
const toastStack = document.getElementById("toastStack");
const emergencyShortcut = document.getElementById("emergencyShortcut");
const safetyTools = document.getElementById("safetyTools");

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
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            showToast("Profile Missing", "This user profile was not found in Firebase.", "error");
            setTimeout(() => {
                redirectToLogin();
            }, 600);
            return;
        }

        currentUser = {
            id: userSnap.id,
            ...userSnap.data()
        };

        updateProfileUI(currentUser);
    } catch (error) {
        console.error("Failed to load user profile:", error);
        showToast("Firebase Error", "Could not load your profile from Firebase.", "error");
        setTimeout(() => {
            redirectToLogin();
        }, 800);
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

async function sendAlert(type, extraData = {}) {
    if (!currentUser) {
        await loadUserProfile();
    }

    if (!currentUser) {
        showToast("Profile Required", "User data is not available from Firebase yet.", "error");
        return;
    }

    let locationData = { latitude: null, longitude: null };

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationData.latitude = position.coords.latitude;
        locationData.longitude = position.coords.longitude;
    } catch (err) {
        console.warn("Could not fetch location for alert:", err.message);
    }

    const alertData = {
        type,
        userId: currentUser.id || userId,
        source: "user-app",
        sourceLabel: "SHAKTHI App",
        confirmedFromApp: true,
        userName: currentUser.fullName || "Unknown",
        userPhone: currentUser.phone || "N/A",
        userEmail: currentUser.email || "",
        emergencyContact: currentUser.emergencyContact || "",
        bloodGroup: currentUser.bloodGroup || "",
        address: currentUser.address || "",
        age: currentUser.age || "",
        gender: currentUser.gender || "",
        timestamp: new Date().toISOString(),
        resolved: false,
        ...locationData,
        ...extraData
    };

    try {
        await addDoc(collection(db, "alerts"), alertData);
        console.log(`${type.toUpperCase()} alert sent to Firestore successfully`);
        return true;
    } catch (err) {
        console.error("Failed to send alert to Firestore:", err);
        showToast("Alert Failed", "The app could not send this notification to Firebase.", "error");
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
            const sent = await sendAlert("sos", { message: "EMERGENCY: SOS triggered from app home" });
            if (sent) {
                showToast("SOS Sent", "Confirmed from SHAKTHI App only. Help is on the way.", "success");
            }
        } else if (toolId === "location") {
            const sent = await sendAlert("location", { message: "Location manual share" });
            if (sent) {
                showToast("Location Shared", "Confirmed from SHAKTHI App only and shared with admin.", "success");
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
