
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // توليد الصور
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        if (!env.OPENAI_API_KEY) {
          return Response.json(
            { error: "مفتاح OpenAI غير مضبوط في Cloudflare." },
            { status: 500 }
          );
        }

        const body = await request.json();
        const prompt = String(body.prompt || "").trim();

        if (!prompt || prompt.length > 32000) {
          return Response.json(
            { error: "اكتب وصفاً صحيحاً للصورة." },
            { status: 400 }
          );
        }

        const response = await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-image-2.5-flare",
              prompt,
              size: "1024x1024",
              n: 1
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          return Response.json(
            { error: result.error?.message || "تعذر إنشاء الصورة." },
            { status: response.status }
          );
        }

        const image = result.data?.[0]?.b64_json;

        if (!image) {
          return Response.json(
            { error: "لم تصل الصورة من OpenAI." },
            { status: 502 }
          );
        }

        return Response.json({
          image: `data:image/png;base64,${image}`
        });

      } catch (error) {
        return Response.json(
          { error: "حدث خطأ في معالجة الطلب." },
          { status: 500 }
        );
      }
    }

    // عرض الصفحة الرئيسية
    if (env.ASSETS) {
      const assetUrl = new URL(request.url);

      if (assetUrl.pathname === "/") {
        assetUrl.pathname = "/index.html";
      }

      return env.ASSETS.fetch(
        new Request(assetUrl, request)
      );
    }

    return new Response(
      "Assets binding not found",
      { status: 500 }
    );
  }
};
