const button = document.getElementById("generate");
const promptInput = document.getElementById("prompt");
const statusBox = document.getElementById("status");
const resultImage = document.getElementById("result");

button.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    statusBox.textContent = "اكتب وصف الصورة أولاً.";
    return;
  }

  button.disabled = true;
  statusBox.textContent = "جارٍ إنشاء الصورة...";
  resultImage.style.display = "none";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "حدث خطأ أثناء إنشاء الصورة");
    }

    resultImage.src = data.image;
    resultImage.style.display = "block";
    statusBox.textContent = "تم إنشاء الصورة بنجاح!";
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
