const resetForm = document.querySelector("#reset-form");
const statusEl = document.querySelector("#reset-status");
const loginLink = document.querySelector("#login-link");
const token = new URLSearchParams(window.location.search).get("token") || "";

document.querySelectorAll(".toggle-password").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "إخفاء" : "إظهار";
    toggle.setAttribute("aria-label", reveal ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  });
});

if (!token) {
  resetForm.hidden = true;
  statusEl.textContent = "رابط إعادة التعيين غير صالح. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.";
  loginLink.hidden = false;
}

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#new-password").value;
  const confirmation = document.querySelector("#confirm-password").value;

  if (password !== confirmation) {
    statusEl.textContent = "كلمتا المرور غير متطابقتين.";
    return;
  }
  if (password.length < 10 || password.length > 128) {
    statusEl.textContent = "كلمة المرور يجب أن تكون بين 10 و128 حرفًا.";
    return;
  }

  const submit = resetForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  statusEl.textContent = "جارٍ تحديث كلمة المرور...";

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذر تغيير كلمة المرور.");

    resetForm.hidden = true;
    statusEl.textContent = data.message || "تم تغيير كلمة المرور بنجاح.";
    loginLink.hidden = false;
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    statusEl.textContent = error.message;
    submit.disabled = false;
  }
});
