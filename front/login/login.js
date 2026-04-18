/* ===== SHAKTHI LOGIN - JS ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

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

// Redirect if already logged in
if (localStorage.getItem('shakthi_logged_in') === 'true') {
    window.location.href = '/index.html';
}

const form = document.getElementById('registrationForm');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous errors
        document.querySelectorAll('.form-group').forEach(g => g.classList.remove('error'));

        let valid = true;

        const fullName = document.getElementById('fullName');
        const phone = document.getElementById('phone');
        const age = document.getElementById('age');
        const gender = document.getElementById('gender');
        const emergencyContact = document.getElementById('emergencyContact');

        if (!fullName.value.trim()) {
            fullName.closest('.form-group').classList.add('error');
            valid = false;
        }

        if (!phone.value.trim() || phone.value.replace(/\D/g, '').length < 10) {
            phone.closest('.form-group').classList.add('error');
            valid = false;
        }

        if (!age.value || age.value < 10 || age.value > 120) {
            age.closest('.form-group').classList.add('error');
            valid = false;
        }

        if (!gender.value) {
            gender.closest('.form-group').classList.add('error');
            valid = false;
        }

        if (!emergencyContact.value.trim() || emergencyContact.value.replace(/\D/g, '').length < 10) {
            emergencyContact.closest('.form-group').classList.add('error');
            valid = false;
        }

        if (!valid) return;

        const userData = {
            fullName: fullName.value.trim(),
            phone: phone.value.trim(),
            age: parseInt(age.value),
            email: document.getElementById('email').value.trim(),
            gender: gender.value,
            bloodGroup: document.getElementById('bloodGroup').value || '',
            emergencyContact: emergencyContact.value.trim(),
            address: document.getElementById('address').value.trim(),
            registeredAt: new Date().toISOString()
        };

        const btn = document.getElementById('btnSubmit');
        btn.textContent = 'Connecting...';
        btn.disabled = true;

        console.log('--- STARTING REGISTRATION ---');

        try {
            const timeout = setTimeout(() => {
                alert('Registration timed out. Please check your internet connection.');
                btn.textContent = 'Register & Continue →';
                btn.disabled = false;
            }, 15000);

            const q = query(collection(db, 'users'), where('phone', '==', userData.phone));
            const existing = await getDocs(q);

            if (!existing.empty) {
                const existingUser = existing.docs[0].data();
                existingUser.id = existing.docs[0].id;
                localStorage.setItem('shakthi_user', JSON.stringify(existingUser));
                localStorage.setItem('shakthi_logged_in', 'true');
            } else {
                const docRef = await addDoc(collection(db, 'users'), userData);
                userData.id = docRef.id;
                localStorage.setItem('shakthi_user', JSON.stringify(userData));
                localStorage.setItem('shakthi_logged_in', 'true');
            }

            clearTimeout(timeout);
            document.getElementById('successOverlay').classList.add('show');

            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);

        } catch (error) {
            console.error('REGISTRATION FAILED:', error);
            alert('Registration failed! ' + error.message);
            btn.textContent = 'Register & Continue →';
            btn.disabled = false;
        }
    });
}
