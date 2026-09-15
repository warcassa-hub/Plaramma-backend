/// GET  /api/admin            - admin panel (HTML, chiroyli dizayn)
/// POST /api/admin            - login yoki amallar (JSON)
/// Parol: Vercel env o'zgaruvchisi ADMIN_PASSWORD (majburiy!).
const crypto = require("crypto");
const {
  getUser,
  saveUser,
  listUsers,
  toStatus,
  setCors,
  readBody,
} = require("./_lib");

const COOKIE = "admin_session";
const sessions = new Set(); // serverless'da qisqa muddatli - parol qayta so'ralishi mumkin

function isAdmin(req) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(new RegExp(COOKIE + "=([^;]+)"));
  return match && sessions.has(match[1]);
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userCard(u) {
  const s = toStatus(u);
  const expired = new Date(s.subscriptionEnd) < new Date();
  const statusLabel = s.blocked
    ? '<span class="tag blocked">Bloklangan</span>'
    : s.deleted
      ? '<span class="tag deleted">O\'chirilgan</span>'
      : expired
        ? '<span class="tag expired">Muddat tugagan</span>'
        : `<span class="tag active">Faol · ${s.daysLeft} kun</span>`;
  return `
  <div class="card" data-id="${escapeHtml(u.deviceId)}">
    <div class="card-head">
      <div>
        <div class="uname">${escapeHtml(u.name || "—")}</div>
        <div class="uphone">${escapeHtml(u.phone || "—")}</div>
      </div>
      ${statusLabel}
    </div>
    <div class="meta">
      <div>📱 ${escapeHtml(u.deviceName)}</div>
      <div>🆔 <span class="mono">${escapeHtml(u.deviceId.slice(0, 13))}…</span></div>
      <div>🕒 Oxirgi faollik: ${fmtDate(u.lastActiveAt)}</div>
      <div>📅 Obuna tugashi: ${fmtDate(u.subscriptionEnd)}</div>
    </div>
    <div class="actions">
      ${
        s.blocked || s.deleted
          ? `<button class="btn ok" onclick="act('unblock','${escapeHtml(u.deviceId)}')">Tiklash</button>`
          : `<button class="btn danger" onclick="act('block','${escapeHtml(u.deviceId)}')">Bloklash</button>`
      }
      <button class="btn primary" onclick="act('subscribe','${escapeHtml(u.deviceId)}')">+30 kun obuna</button>
      ${!s.blocked && !s.deleted ? `<button class="btn warn" onclick="act('unsubscribe','${escapeHtml(u.deviceId)}')">Obunani o'chirish</button>` : ""}
      ${!s.deleted ? `<button class="btn danger outline" onclick="act('delete','${escapeHtml(u.deviceId)}')">O'chirish</button>` : ""}
    </div>
  </div>`;
}

function renderPage(users, error) {
  const cards = users.map(userCard).join("\n");
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parket Boshqaruv — Admin</title>
<style>
  :root { --bg:#0f1420; --card:#1a2233; --line:#2a3550; --txt:#e8edf7; --mut:#8fa0bf;
          --blue:#4f7cff; --green:#31c48d; --red:#f05252; --amber:#f0a13b; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--txt); font-family:'Segoe UI',system-ui,sans-serif;
         min-height:100vh; padding:24px 16px 60px; }
  .wrap { max-width:880px; margin:0 auto; }
  header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
  h1 { font-size:1.35rem; letter-spacing:.3px; }
  h1 span { color:var(--blue); }
  .sub { color:var(--mut); font-size:.85rem; margin-top:4px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:24px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
  .stat b { font-size:1.4rem; display:block; }
  .stat small { color:var(--mut); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px; margin-bottom:14px;
          transition:border-color .2s; }
  .card:hover { border-color:#3d4d75; }
  .card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .uname { font-weight:600; font-size:1.05rem; }
  .uphone { color:var(--mut); font-size:.88rem; }
  .tag { font-size:.75rem; padding:4px 10px; border-radius:999px; white-space:nowrap; font-weight:600; }
  .tag.active { background:rgba(49,196,141,.15); color:var(--green); }
  .tag.blocked, .tag.deleted { background:rgba(240,82,82,.15); color:var(--red); }
  .tag.expired { background:rgba(240,161,59,.15); color:var(--amber); }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; color:var(--mut);
          font-size:.82rem; margin:14px 0; }
  .mono { font-family:ui-monospace,monospace; }
  .actions { display:flex; flex-wrap:wrap; gap:8px; }
  .btn { border:none; border-radius:10px; padding:8px 14px; font-size:.82rem; font-weight:600;
         cursor:pointer; transition:filter .15s, opacity .15s; }
  .btn:hover { filter:brightness(1.15); }
  .btn:disabled { opacity:.5; cursor:wait; }
  .btn.primary { background:var(--blue); color:#fff; }
  .btn.ok { background:var(--green); color:#06281b; }
  .btn.warn { background:var(--amber); color:#3a2400; }
  .btn.danger { background:var(--red); color:#fff; }
  .btn.danger.outline { background:transparent; color:var(--red); border:1px solid var(--red); }
  .login { background:var(--card); border:1px solid var(--line); border-radius:16px;
           padding:32px; max-width:380px; margin:60px auto; }
  .login h2 { margin-bottom:18px; font-size:1.1rem; }
  input[type=password] { width:100%; background:#0d1220; border:1px solid var(--line); color:var(--txt);
         border-radius:10px; padding:12px 14px; font-size:.95rem; margin-bottom:14px; }
  input[type=password]:focus { outline:none; border-color:var(--blue); }
  .error { color:var(--red); font-size:.85rem; margin-bottom:12px; }
  .empty { text-align:center; color:var(--mut); padding:60px 0; }
  .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--green);
           color:#06281b; padding:10px 20px; border-radius:999px; font-weight:600; font-size:.85rem;
           opacity:0; transition:opacity .3s; pointer-events:none; }
  .toast.show { opacity:1; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>🪵 Parket <span>Boshqaruv</span> — Admin</h1>
      <div class="sub">Foydalanuvchilar, obunalar va bloklash boshqaruvi</div>
    </div>
    <button class="btn danger outline" onclick="logout()">Chiqish</button>
  </header>
  <div class="stats">
    <div class="stat"><b>${
      users.filter((u) => {
        const s = toStatus(u);
        return (
          !s.blocked && !s.deleted && new Date(s.subscriptionEnd) > new Date()
        );
      }).length
    }</b><small>Faol</small></div>
    <div class="stat"><b>${users.filter((u) => u.blocked || u.deleted).length}</b><small>Blok/O'chirilgan</small></div>
    <div class="stat"><b>${users.length}</b><small>Jami foydalanuvchi</small></div>
  </div>
  ${cards || '<div class="empty">Hozircha foydalanuvchilar yo\'q</div>'}
</div>
<div class="toast" id="toast"></div>
<script>
async function act(action, deviceId) {
  const r = await fetch('', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, deviceId })
  });
  if (r.ok) { toast('✅ Bajarildi'); setTimeout(() => location.reload(), 500); }
  else toast('❌ Xatolik');
}
async function logout() {
  await fetch('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }) });
  location.reload();
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
</script>
</body>
</html>`;
}

function renderLogin(error) {
  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin — Kirish</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0f1420; color:#e8edf7; font-family:'Segoe UI',system-ui,sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:16px; }
  .box { background:#1a2233; border:1px solid #2a3550; border-radius:18px; padding:36px;
         width:100%; max-width:380px; text-align:center; }
  .logo { font-size:2.2rem; }
  h2 { margin:12px 0 22px; font-size:1.15rem; }
  input { width:100%; background:#0d1220; border:1px solid #2a3550; color:#e8edf7;
          border-radius:12px; padding:13px 15px; font-size:.95rem; margin-bottom:14px; }
  input:focus { outline:none; border-color:#4f7cff; }
  button { width:100%; background:#4f7cff; color:#fff; border:none; border-radius:12px;
           padding:13px; font-size:.95rem; font-weight:600; cursor:pointer; }
  button:hover { filter:brightness(1.15); }
  .error { color:#f05252; font-size:.85rem; margin-bottom:12px; }
</style></head>
<body>
<div class="box">
  <div class="logo">🪵</div>
  <h2>Parket Boshqaruv — Admin panel</h2>
  ${error ? '<div class="error">Parol xato, qaytadan urinib ko\'ring</div>' : ""}
  <form method="POST">
    <input type="password" name="password" placeholder="Admin paroli" autofocus>
    <button type="submit">Kirish</button>
  </form>
</div>
</body></html>`;
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // ===== LOGIN (formadan) =====
  if (
    req.method === "POST" &&
    (req.headers["content-type"] || "").includes(
      "application/x-www-form-urlencoded",
    )
  ) {
    let raw = "";
    for await (const c of req) raw += c;
    const password = new URLSearchParams(raw).get("password");
    if (password === process.env.ADMIN_PASSWORD) {
      const token = crypto.randomUUID();
      sessions.add(token);
      res.setHeader(
        "Set-Cookie",
        `${COOKIE}=${token}; HttpOnly; Secure; Path=/; Max-Age=86400`,
      );
      return res.status(303).setHeader("Location", "/api/admin").end();
    }
    return res.status(401).send(renderLogin(true));
  }

  // ===== AMALLAR (JSON) =====
  if (req.method === "POST") {
    const body = await readBody(req);

    if (body.action === "login") {
      if (body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: "wrong_password" });
      }
      const token = crypto.randomUUID();
      sessions.add(token);
      res.setHeader(
        "Set-Cookie",
        `${COOKIE}=${token}; HttpOnly; Secure; Path=/; Max-Age=86400`,
      );
      return res.status(200).json({ ok: true });
    }

    if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });

    const user = await getUser(body.deviceId);
    if (!user && body.action !== "logout") {
      return res.status(404).json({ error: "not_found" });
    }

    switch (body.action) {
      case "logout":
        sessions.clear();
        res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0`);
        return res.status(200).json({ ok: true });
      case "block":
        user.blocked = true;
        break;
      case "unblock":
        user.blocked = false;
        user.deleted = false;
        break;
      case "subscribe":
        // Mavjud obunadan davom etish (agar hali tugamagan bo'lsa) + 30 kun.
        const base =
          new Date(user.subscriptionEnd) > new Date()
            ? new Date(user.subscriptionEnd)
            : new Date();
        user.subscriptionEnd = new Date(
          base.getTime() + 30 * 86400000,
        ).toISOString();
        user.blocked = false;
        break;
      case "unsubscribe":
        user.subscriptionEnd = new Date().toISOString(); // darhol tugatish
        break;
      case "delete":
        user.deleted = true; // ilova tomonidan chiqarib yuboriladi
        break;
      default:
        return res.status(400).json({ error: "unknown_action" });
    }

    await saveUser(user);
    return res.status(200).json({ ok: true, status: toStatus(user) });
  }

  // ===== SAHIFA =====
  if (req.method === "GET") {
    if (!isAdmin(req)) return res.status(200).send(renderLogin(false));
    const users = await listUsers();
    return res.status(200).send(renderPage(users, false));
  }

  return res.status(405).end();
};
