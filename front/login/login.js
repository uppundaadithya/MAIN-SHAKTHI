/* ===== SHAKTHI ACCESS - JS ===== */
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

const storedUserId = localStorage.getItem("shakthi_user_id");
if (storedUserId) {
    window.location.href = `/user/index.html?userId=${encodeURIComponent(storedUserId)}`;
}

const loginForm = document.getElementById("loginForm");
const registrationForm = document.getElementById("registrationForm");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");
const modeTitle = document.getElementById("modeTitle");
const modeText = document.getElementById("modeText");
const successOverlay = document.getElementById("successOverlay");
const successTitle = document.getElementById("successTitle");
const successText = document.getElementById("successText");
const toastStack = document.getElementById("toastStack");

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

function setAuthMode(mode) {
    const isLogin = mode === "login";

    loginForm?.classList.toggle("hidden-form", !isLogin);
    registrationForm?.classList.toggle("hidden-form", isLogin);
    showLoginBtn?.classList.toggle("active", isLogin);
    showRegisterBtn?.classList.toggle("active", !isLogin);

    if (modeTitle) {
        modeTitle.textContent = isLogin ? "Welcome back" : "Create your safety profile";
    }

    if (modeText) {
        modeText.textContent = isLogin
            ? "Already registered? Enter your phone number and continue."
            : "New to SHAKTHI? Register once and we will remember you on this device.";
    }
}

function saveSession(userId) {
    localStorage.setItem("shakthi_user_id", userId);
    localStorage.setItem("shakthi_logged_in", "true");
}

function redirectToDashboard(userId) {
    window.location.href = `/user/index.html?userId=${encodeURIComponent(userId)}`;
}

function showSuccess(title, text) {
    if (successTitle) successTitle.textContent = title;
    if (successText) successText.textContent = text;
    successOverlay?.classList.add("show");
}

function clearErrors(form) {
    form?.querySelectorAll(".form-group").forEach((group) => group.classList.remove("error"));
}

showLoginBtn?.addEventListener("click", () => setAuthMode("login"));
showRegisterBtn?.addEventListener("click", () => setAuthMode("register"));

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(loginForm);

    const phoneInput = document.getElementById("loginPhone");
    const phone = phoneInput.value.trim();

    if (!phone || phone.replace(/\D/g, "").length < 10) {
        phoneInput.closest(".form-group").classList.add("error");
        return;
    }

    const loginBtn = document.getElementById("btnLogin");
    loginBtn.textContent = "Checking...";
    loginBtn.disabled = true;

    try {
        const q = query(collection(db, "users"), where("phone", "==", phone));
        const existing = await getDocs(q);

        if (existing.empty) {
            phoneInput.closest(".form-group").classList.add("error");
            showToast("User Not Found", "No registered user was found with this phone number.", "error");
            return;
        }

        const userId = existing.docs[0].id;
        saveSession(userId);
        showSuccess("Login Complete!", "Opening your SHAKTHI dashboard...");

        setTimeout(() => {
            redirectToDashboard(userId);
        }, 1200);
    } catch (error) {
        console.error("LOGIN FAILED:", error);
        showToast("Login Failed", error.message, "error");
    } finally {
        loginBtn.textContent = "Login & Continue ->";
        loginBtn.disabled = false;
    }
});

registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(registrationForm);

    let valid = true;

    const fullName = document.getElementById("fullName");
    const phone = document.getElementById("phone");
    const age = document.getElementById("age");
    const gender = document.getElementById("gender");
    const emergencyContact = document.getElementById("emergencyContact");

    if (!fullName.value.trim()) {
        fullName.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!phone.value.trim() || phone.value.replace(/\D/g, "").length < 10) {
        phone.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!age.value || age.value < 10 || age.value > 120) {
        age.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!gender.value) {
        gender.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!emergencyContact.value.trim() || emergencyContact.value.replace(/\D/g, "").length < 10) {
        emergencyContact.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!valid) {
        return;
    }

    const userData = {
        fullName: fullName.value.trim(),
        phone: phone.value.trim(),
        age: parseInt(age.value, 10),
        email: document.getElementById("email").value.trim(),
        gender: gender.value,
        bloodGroup: document.getElementById("bloodGroup").value || "",
        emergencyContact: emergencyContact.value.trim(),
        address: document.getElementById("address").value.trim(),
        registeredAt: new Date().toISOString()
    };

    const registerBtn = document.getElementById("btnSubmit");
    registerBtn.textContent = "Connecting...";
    registerBtn.disabled = true;

    try {
        const q = query(collection(db, "users"), where("phone", "==", userData.phone));
        const existing = await getDocs(q);

        let userId = "";

        if (!existing.empty) {
            userId = existing.docs[0].id;
        } else {
            const docRef = await addDoc(collection(db, "users"), userData);
            userId = docRef.id;
        }

        saveSession(userId);
        showSuccess("Registration Complete!", "Opening your SHAKTHI dashboard...");

        setTimeout(() => {
            redirectToDashboard(userId);
        }, 1200);
    } catch (error) {
        console.error("REGISTRATION FAILED:", error);
        showToast("Registration Failed", error.message, "error");
    } finally {
        registerBtn.textContent = "Register & Continue ->";
        registerBtn.disabled = false;
    }
});

setAuthMode("login");
