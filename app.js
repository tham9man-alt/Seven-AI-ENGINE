
const authPanel = document.querySelector("#auth-panel");
const accountPanel = document.querySelector("#account-panel");
const studio = document.querySelector("#studio");
const authStatus = document.querySelector("#auth-status");

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");

const showLogin = document.querySelector("#show-login");
const showRegister = document.querySelector("#show-register");

function showAuth() {
  authPanel.hidden = false;
  accountPanel.hidden = true;
  studio.hidden = true;
}

function showAccount(user) {
  authPanel.hidden = true;
  accountPanel.hidden = false;
  studio.hidden = false;
  document.querySelector("#account-email").textContent = user.email;
}

showLogin.addEventListener("click", () => {
  loginForm.hidden = false;
  registerForm.hidden = true;
  authStatus.textContent = "";
});

showRegister.addEventListener("click", () => {
  loginForm.hidden = true;
  registerForm.hidden = false;
  authStatus.textContent = "";
});

async function checkSession() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin"
    });
    const data = await response.json();

    if (response.ok && data.authenticated && data.user) {
      showAccount(data.user);
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authStatus.textContent = "جارٍ تسجيل الدخول...";

  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "تعذر تسجيل الدخول.");
    }

    loginForm.reset();
    showAccount(data.user);
    authStatus.textContent = "";
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authStatus.textContent = "جارٍ إنشاء الحساب...";

  const email = document.querySelector("#register-email").value.trim();
  const password = document.querySelector("#register-password").value;

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "تعذر إنشاء الحساب.");
    }

    registerForm.reset();
    showAccount(data.user);
    authStatus.textContent = "";
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("تعذر تسجيل الخروج.");
    }

    showAuth();
    loginForm.reset();
    registerForm.reset();
    authStatus.textContent = "تم تسجيل الخروج.";
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

// Image generation
const promptEl = document.querySelector("#prompt");
const styleEl = document.querySelector("#style");
const ratioEl = document.querySelector("#ratio");
const button = document.querySelector("#generate");
const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#result");
const downloadEl = document.querySelector("#download");

button.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();

  if (!prompt) {
    statusEl.textContent = "اكتب وصف الصورة أولاً.";
    promptEl.focus();
    return;
  }

  button.disabled = true;
  button.textContent = "جارٍ تجهيز طلبك...";
  statusEl.textContent = "نتواصل مع خدمة توليد الصور...";
  downloadEl.classList.add("hidden");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        size: ratioEl.value
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      showAuth();
      throw new Error("انتهت جلستك. سجّل الدخول من جديد.");
    }

    if (!response.ok) {
      throw new Error(data.error || "تعذر إنشاء الصورة.");
    }

    if (!data.image) {
      throw new Error("وصل رد غير متوقع من الخادم.");
    }

    resultEl.innerHTML = "";

    const img = document.createElement("img");
    img.alt = "الصورة التي تم إنشاؤها";
    img.src = data.image;
    resultEl.appendChild(img);

    downloadEl.href = data.image;
    downloadEl.classList.remove("hidden");
    statusEl.textContent = "اكتمل الإنشاء بنجاح.";
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "✦ إنشاء الصورة";
  }
});

checkSession();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
