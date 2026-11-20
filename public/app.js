
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        size: ratioEl.value
      })
    });

    const data = await response.json().catch(() => ({}));

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
    statusEl.textContent =
      error.message + " تأكد من إعداد خدمة التوليد على الخادم.";
  } finally {
    button.disabled = false;
    button.textContent = "✦ إنشاء الصورة";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
