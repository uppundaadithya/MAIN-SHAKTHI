const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "admin123"
};

const SESSION_KEY = "shakthi_admin_logged_in";
const USER_KEY = "shakthi_admin_user";

const form = document.getElementById("adminLoginForm");
const loginBtn = document.getElementById("adminLoginBtn");
const toastStack = document.getElementById("toastStack");

if (localStorage.getItem(SESSION_KEY) === "true") {
    window.location.href = "/admin/admin.html";
}

function showToast(title, message, tone = "error") {
    if (!toastStack) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function clearErrors() {
    document.querySelectorAll(".form-group").forEach((group) => group.classList.remove("error"));
}

form?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();

    const usernameInput = document.getElementById("adminUsername");
    const passwordInput = document.getElementById("adminPassword");
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    let valid = true;

    if (!username) {
        usernameInput.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!password) {
        passwordInput.closest(".form-group").classList.add("error");
        valid = false;
    }

    if (!valid) {
        return;
    }

    loginBtn.textContent = "Checking...";
    loginBtn.disabled = true;

    const isValid =
        username === ADMIN_CREDENTIALS.username &&
        password === ADMIN_CREDENTIALS.password;

    if (!isValid) {
        showToast("Access Denied", "Use the correct admin username and password.", "error");
        loginBtn.textContent = "Login to Dashboard";
        loginBtn.disabled = false;
        return;
    }

    localStorage.setItem(SESSION_KEY, "true");
    localStorage.setItem(USER_KEY, username);
    showToast("Access Granted", "Opening the SHAKTHI admin dashboard.", "success");

    setTimeout(() => {
        window.location.href = "/admin/admin.html";
    }, 800);
});
