const ADMIN_SESSION_KEY = "shakthi_admin_logged_in";
const ADMIN_USER_KEY = "shakthi_admin_user";

const CREDENTIALS = {
    username: "admin",
    password: "shakthi@admin"
};

function showFieldError(inputEl, message) {
    const group = inputEl.closest(".form-group");
    if (!group) return;
    const errorEl = group.querySelector(".error-msg");
    if (errorEl) errorEl.textContent = message;
    group.classList.add("has-error");
}

function clearFieldErrors() {
    document.querySelectorAll(".form-group.has-error").forEach((g) => {
        g.classList.remove("has-error");
        const e = g.querySelector(".error-msg");
        if (e) e.textContent = "Username is required" || e.textContent;
        const pwdGroup = g.querySelector("#adminPassword")?.closest(".form-group");
        if (pwdGroup) {
            const pwdErr = pwdGroup.querySelector(".error-msg");
            if (pwdErr) pwdErr.textContent = "Password is required";
        }
    });
}

function showToast(message, type = "error") {
    const existing = document.querySelector(".login-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `login-toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
        "padding:12px 24px;border-radius:8px;font-size:14px;color:#fff;" +
        "z-index:9999;transition:opacity .3s;" +
        (type === "error" ? "background:#dc2626;" : "background:#16a34a;");
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const form = document.getElementById("adminLoginForm");
if (form) {
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearFieldErrors();

        const username = document.getElementById("adminUsername").value.trim();
        const password = document.getElementById("adminPassword").value;
        const btn = document.getElementById("adminLoginBtn");

        // Validate
        let valid = true;
        if (!username) {
            showFieldError(document.getElementById("adminUsername"), "Username is required");
            valid = false;
        }
        if (!password) {
            showFieldError(document.getElementById("adminPassword"), "Password is required");
            valid = false;
        }
        if (!valid) return;

        // Disable button while checking
        btn.disabled = true;
        btn.textContent = "Authenticating...";

        // Check credentials
        setTimeout(() => {
            if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
                localStorage.setItem(ADMIN_SESSION_KEY, "true");
                localStorage.setItem(ADMIN_USER_KEY, username);
                showToast("Login successful! Redirecting...", "success");
                btn.textContent = "Login to Dashboard";
                btn.disabled = false;
                setTimeout(() => {
                    window.location.href = "/admin/admin.html";
                }, 800);
            } else {
                showToast("Invalid username or password.");
                btn.textContent = "Login to Dashboard";
                btn.disabled = false;
                document.getElementById("adminPassword").value = "";
            }
        }, 500);
    });
}
