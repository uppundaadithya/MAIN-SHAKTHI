// ===== SHAKTHI - Main App Script =====
// Handles all tool button clicks and sends alerts to admin via Firebase Firestore

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// Firebase Config
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

// --- AUTH CHECK ---
if (localStorage.getItem('shakthi_logged_in') !== 'true') {
    window.location.href = '/login.html';
}

// Get stored user data
const currentUser = JSON.parse(localStorage.getItem('shakthi_user') || '{}');

// --- Helper: Send alert to Firestore 'alerts' collection ---
async function sendAlert(type, extraData = {}) {
    console.log(`Sending ${type} alert with location...`);
    
    // Always attempt to get location for EVERY alert
    let locationData = { latitude: null, longitude: null };
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationData.latitude = position.coords.latitude;
        locationData.longitude = position.coords.longitude;
        console.log('Location fetched:', locationData);
    } catch (err) {
        console.warn('Could not fetch location for alert:', err.message);
    }

    const alertData = {
        type: type,
        userName: currentUser.fullName || 'Unknown',
        userPhone: currentUser.phone || 'N/A',
        userEmail: currentUser.email || '',
        emergencyContact: currentUser.emergencyContact || '',
        bloodGroup: currentUser.bloodGroup || '',
        address: currentUser.address || '',
        age: currentUser.age || '',
        gender: currentUser.gender || '',
        timestamp: new Date().toISOString(),
        resolved: false,
        ...locationData,
        ...extraData
    };

    try {
        await addDoc(collection(db, 'alerts'), alertData);
        console.log(`✅ ${type.toUpperCase()} alert sent to Firestore successfully`);
    } catch (err) {
        console.error('❌ Failed to send alert to Firestore:', err);
    }
}

// --- Global Tool Listener ---
// This ensures that clicking ANY box/tool sends location to admin
document.querySelectorAll('.tool').forEach((tool, index) => {
    tool.addEventListener('click', () => {
        const toolId = tool.id || `tool-${index + 1}`;
        console.log(`Tool clicked: ${toolId}`);
        
        // Visual feedback
        tool.style.transform = "scale(0.9)";
        setTimeout(() => tool.style.transform = "scale(1)", 100);

        // Special handling for specific buttons but ALL send location
        if (toolId === 'sosTrigger') {
            sendAlert('sos', { message: 'EMERGENCY: SOS triggered from app home' });
            alert("🚨 SOS Sent! Help is on the way.");
        } else if (toolId === 'location') {
            sendAlert('location', { message: 'Location manual share' });
            alert("📍 Location shared with Admin");
        } else if (toolId === 'alarmTrigger') {
            playAlarmLocally();
            sendAlert('alarm', { message: 'Personal alarm activated' });
        } else if (toolId === 'emergencyBtn') {
            const num = tool.getAttribute('data-number') || '123';
            console.log(`Automatically calling ${num}...`);
            sendAlert('call', { message: `Automatic emergency call to ${num}` });
            window.location.href = `tel:${num}`;
        } else {
            // General alert for any other box (potions)
            sendAlert('general', { message: `Tool box ${index + 1} was interacted with` });
        }
    });
});

function playAlarmLocally() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();

        let count = 0;
        const alarmInterval = setInterval(() => {
            const t = audioCtx.currentTime;
            oscillator.frequency.setValueAtTime(count % 2 === 0 ? 1200 : 600, t);
            count++;
            if (count > 20) {
                clearInterval(alarmInterval);
                gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                setTimeout(() => { oscillator.stop(); audioCtx.close(); }, 300);
            }
        }, 200);
    } catch (e) {
        console.warn('Audio error:', e);
    }
}
