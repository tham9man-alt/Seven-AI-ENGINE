
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers }
  });
}

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error("Invalid hexadecimal value");
  }
  return new Uint8Array(value.match(/.{2}/g).map(x => parseInt(x, 16)));
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return hex(new Uint8Array(digest));
}

async function hashPassword(password, salt, iterations = 120000) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return hex(new Uint8Array(result));
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function readJson(request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const item = cookies.split(";").map(value => value.trim()).find(value => value.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : null;
}

function sessionCookie(token) {
  return `seven_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function clearCookie() {
  return "seven_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

async function makeSession(userId) {
  const token = base64url(randomBytes(32));
  return {
    token,
    tokenHash: await hashToken(token),
    userId,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function createSession(db, userId) {
  const session = await makeSession(userId);
  await db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(session.tokenHash, session.userId, session.expires).run();
  return session.token;
}

async function getUser(request, db) {
  const token = getCookie(request, "seven_session");
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const session = await db.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(tokenHash, new Date().toISOString()).first();

  if (!session) return null;
  return db.prepare("SELECT id, email FROM users WHERE id = ?").bind(session.user_id).first();
}

function originAllowed(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.DB;

    // Request a password reset. Always return a generic response to avoid account enumeration.
    if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
      if (!db) return json({ error: "تعذر معالجة الطلب حاليًا." }, 500);
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);

      const genericMessage = "إذا كان البريد مسجلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.";
      let pendingTokenHash = null;
      try {
        const body = await readJson(request);
        if (!body) return json({ success: true, message: genericMessage });

        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          return json({ success: true, message: genericMessage });
        }

        const user = await db.prepare("SELECT id, email FROM users WHERE email = ?")
          .bind(email).first();
        if (!user) return json({ success: true, message: genericMessage });

        const now = new Date().toISOString();
        await db.prepare("DELETE FROM password_resets WHERE expires_at <= ?").bind(now).run();

        const recent = await db.prepare(
          "SELECT COUNT(*) AS total FROM password_resets WHERE user_id = ? AND created_at > datetime('now', '-15 minutes')"
        ).bind(user.id).first();
        if (Number(recent?.total || 0) >= 3) {
          return json({ success: true, message: genericMessage });
        }

        const token = base64url(randomBytes(32));
        const tokenHash = await hashToken(token);
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await db.prepare(
          "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
        ).bind(tokenHash, user.id, expires).run();
        pendingTokenHash = tokenHash;

        if (!env.RESEND_API_KEY) {
          console.error("PASSWORD RESET EMAIL ERROR: RESEND_API_KEY is missing");
          await db.prepare("UPDATE password_resets SET expires_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), pendingTokenHash).run();
          pendingTokenHash = null;
          return json({ success: true, message: genericMessage });
        }

        const resetUrl = new URL("/reset-password.html", url.origin);
        resetUrl.searchParams.set("token", token);
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "SEVEN AI ENGINE <onboarding@resend.dev>",
            to: [env.RESEND_TEST_TO || user.email],
            subject: "إعادة تعيين كلمة المرور - SEVEN AI ENGINE",
            text: `تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك. افتح الرابط التالي خلال 30 دقيقة:\n\n${resetUrl.toString()}\n\nإذا لم تطلب ذلك، فتجاهل هذه الرسالة.`,
            html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#222"><h2>إعادة تعيين كلمة المرور</h2><p>تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك في SEVEN AI ENGINE.</p><p><a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 22px;background:#d71932;color:#fff;text-decoration:none;border-radius:8px">تعيين كلمة مرور جديدة</a></p><p>الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.</p><p>إذا لم تطلب إعادة التعيين، فتجاهل هذه الرسالة.</p></div>`
          })
        });

        if (!emailResponse.ok) {
          const detail = await emailResponse.text().catch(() => "");
          console.error("PASSWORD RESET EMAIL ERROR:", emailResponse.status, detail.slice(0, 500));
          await db.prepare("UPDATE password_resets SET expires_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), pendingTokenHash).run();
        }
        pendingTokenHash = null;
        return json({ success: true, message: genericMessage });
      } catch (error) {
        if (pendingTokenHash) {
          try {
            await db.prepare("UPDATE password_resets SET expires_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), pendingTokenHash).run();
          } catch (cleanupError) {
            console.error("PASSWORD RESET TOKEN CLEANUP ERROR:", cleanupError);
          }
        }
        console.error("FORGOT PASSWORD ERROR:", error);
        return json({ success: true, message: genericMessage });
      }
    }

    // Complete a password reset with a single-use, time-limited token.
    if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);

      try {
        const body = await readJson(request);
        if (!body) return json({ error: "بيانات الطلب غير صحيحة." }, 400);

        const token = String(body.token || "");
        const password = String(body.password || "");
        if (token.length < 20 || token.length > 200) {
          return json({ error: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية." }, 400);
        }
        if (password.length < 10 || password.length > 128) {
          return json({ error: "كلمة المرور يجب أن تكون بين 10 و128 حرفًا." }, 400);
        }

        const tokenHash = await hashToken(token);
        const now = new Date().toISOString();
        const validReset = await db.prepare(
          "SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?"
        ).bind(tokenHash, now).first();
        if (!validReset) {
          return json({ error: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية." }, 400);
        }

        // Reject invalid/expired tokens before performing the expensive password derivation.
        // The token is still re-validated and consumed atomically in the batch below.
        const salt = hex(randomBytes(16));
        const passwordHash = await hashPassword(password, salt, 120000);

        // Consume the token and update the account in one atomic D1 batch.
        // A concurrent/replayed request cannot reuse a token after the first batch commits.
        const results = await db.batch([
          db.prepare(
            "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = (SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?)"
          ).bind(passwordHash, salt, tokenHash, now),
          db.prepare(
            "DELETE FROM sessions WHERE user_id = (SELECT user_id FROM password_resets WHERE token_hash = ?)"
          ).bind(tokenHash),
          db.prepare(
            "DELETE FROM password_resets WHERE user_id = (SELECT user_id FROM password_resets WHERE token_hash = ?)"
          ).bind(tokenHash)
        ]);

        if (Number(results?.[0]?.meta?.changes || 0) !== 1) {
          return json({ error: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية." }, 400);
        }

        return json({ success: true, message: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." });
      } catch (error) {
        console.error("RESET PASSWORD ERROR:", error);
        return json({ error: "تعذر تغيير كلمة المرور حاليًا." }, 500);
      }
    }

    // Registration
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      console.log("REGISTER REQUEST RECEIVED");
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);

      try {
        const body = await readJson(request);
        if (!body) return json({ error: "بيانات الطلب غير صحيحة." }, 400);

        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          return json({ error: "أدخل بريدًا إلكترونيًا صحيحًا." }, 400);
        }
        if (password.length < 10 || password.length > 128) {
          return json({ error: "كلمة المرور يجب أن تكون بين 10 و128 حرفًا." }, 400);
        }

        const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existing) return json({ error: "تعذر إنشاء الحساب بهذا البريد." }, 409);

        const id = crypto.randomUUID();
        const salt = hex(randomBytes(16));
        const passwordHash = await hashPassword(password, salt, 120000);
        const session = await makeSession(id);

        // D1 batch runs these statements transactionally.
        await db.batch([
          db.prepare(
            "INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)"
          ).bind(id, email, passwordHash, salt),
          db.prepare(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
          ).bind(session.tokenHash, id, session.expires)
        ]);

        console.log("REGISTER SUCCESS");
        return json(
          { success: true, user: { id, email } },
          201,
          { "Set-Cookie": sessionCookie(session.token) }
        );
      } catch (error) {
        console.error("REGISTER ERROR:", error);
        if (String(error?.message || "").includes("UNIQUE constraint failed: users.email")) {
          return json({ error: "تعذر إنشاء الحساب بهذا البريد." }, 409);
        }
        return json({ error: "تعذر إنشاء الحساب." }, 500);
      }
    }

    // Login
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);

      try {
        const body = await readJson(request);
        if (!body) return json({ error: "بيانات الطلب غير صحيحة." }, 400);

        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (password.length > 128) {
          return json({ error: "البريد أو كلمة المرور غير صحيحة." }, 401);
        }

        const user = await db.prepare(
          "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?"
        ).bind(email).first();

        if (!user) return json({ error: "البريد أو كلمة المرور غير صحيحة." }, 401);

        let usedIterations = 120000;
        let passwordHash = await hashPassword(password, user.password_salt, usedIterations);

        if (!constantTimeEqual(passwordHash, user.password_hash)) {
          usedIterations = 100000;
          passwordHash = await hashPassword(password, user.password_salt, usedIterations);
        }

        if (!constantTimeEqual(passwordHash, user.password_hash)) {
          return json({ error: "البريد أو كلمة المرور غير صحيحة." }, 401);
        }

        // Upgrade verified legacy 100k passwords to the current 120k setting.
        if (usedIterations === 100000) {
          const newSalt = hex(randomBytes(16));
          const newHash = await hashPassword(password, newSalt, 120000);
          await db.prepare(
            "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?"
          ).bind(newHash, newSalt, user.id).run();
        }

        const token = await createSession(db, user.id);
        console.log("LOGIN SUCCESS");
        return json(
          { success: true, user: { id: user.id, email: user.email } },
          200,
          { "Set-Cookie": sessionCookie(token) }
        );
      } catch (error) {
        console.error("LOGIN ERROR:", error);
        return json({ error: "تعذر تسجيل الدخول." }, 500);
      }
    }

    // Current user
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);
      try {
        const user = await getUser(request, db);
        return json({ authenticated: !!user, user: user || null });
      } catch (error) {
        console.error("SESSION ERROR:", error);
        return json({ error: "تعذر التحقق من الحساب." }, 500);
      }
    }

    // Logout
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);

      try {
        const token = getCookie(request, "seven_session");
        if (token) {
          const tokenHash = await hashToken(token);
          await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
        }
        return json({ success: true }, 200, { "Set-Cookie": clearCookie() });
      } catch (error) {
        console.error("LOGOUT ERROR:", error);
        return json({ error: "تعذر تسجيل الخروج." }, 500);
      }
    }

    // Image generation
    if (url.pathname === "/api/generate" && request.method === "POST") {
      if (!originAllowed(request, url)) return json({ error: "طلب غير مسموح." }, 403);
      if (!db) return json({ error: "قاعدة البيانات غير مربوطة." }, 500);

      try {
        const user = await getUser(request, db);
        if (!user) return json({ error: "يجب تسجيل الدخول أولاً." }, 401);
        if (!env.OPENAI_API_KEY) {
          return json({ error: "مفتاح OpenAI غير مضبوط في Cloudflare." }, 500);
        }

        const body = await readJson(request);
        if (!body) return json({ error: "بيانات الطلب غير صحيحة." }, 400);
        const prompt = String(body.prompt || "").trim();
        if (!prompt || prompt.length > 32000) {
          return json({ error: "اكتب وصفًا صحيحًا للصورة." }, 400);
        }

        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-image-2.5-flare",
            prompt,
            size: "1024x1024",
            n: 1
          })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error("OPENAI IMAGE ERROR:", response.status, result.error?.message || "Unknown error");
          return json(
            { error: result.error?.message || "تعذر إنشاء الصورة." },
            response.status
          );
        }

        const image = result.data?.[0]?.b64_json;
        if (!image) return json({ error: "لم تصل الصورة من OpenAI." }, 502);
        return json({ image: `data:image/png;base64,${image}` });
      } catch (error) {
        console.error("IMAGE ERROR:", error);
        return json({ error: "حدث خطأ في معالجة الطلب." }, 500);
      }
    }

    // Website assets
    if (env.ASSETS) {
      if (url.pathname === "/") {
        url.pathname = "/index.html";
        return env.ASSETS.fetch(new Request(url, request));
      }
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
