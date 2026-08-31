/**
 * NodeCraft Automation — site server + Admin Panel API
 * --------------------------------------------------------------
 * Serves the public website from /public, and exposes a JSON API
 * (under /api) that the Admin Panel (at /admin) uses to read and
 * write the site's content. All content lives in data/content.json
 * so that every change made in the Admin Panel is saved to disk
 * and immediately shows up for every visitor on the next page load.
 * --------------------------------------------------------------
 */

const express = require("express");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "assets", "uploads");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const THEMES_FILE = path.join(DATA_DIR, "themes.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// First-run setup: create the default admin account if missing
// ---------------------------------------------------------------
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "Admin@123";

function ensureAdminAccount() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
    const secret = crypto.randomBytes(32).toString("hex");
    const admin = {
      username: DEFAULT_USERNAME,
      passwordHash: hash,
      sessionSecret: secret,
      mustChangePassword: true
    };
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2));
    console.log("Created default admin account -> username: admin / password: Admin@123");
    console.log("IMPORTANT: change this password from inside the Admin Panel before going live.");
  }
}
ensureAdminAccount();

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readAdmin() {
  return readJSON(ADMIN_FILE);
}
function writeAdmin(data) {
  writeJSON(ADMIN_FILE, data);
}

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------
// Simple stateless session tokens (HMAC signed, no server memory
// needed, so logins survive server restarts).
// ---------------------------------------------------------------
const SESSION_COOKIE = "nc_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signToken(payloadObj, secret) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const admin = readAdmin();
  const token = req.cookies[SESSION_COOKIE];
  const session = verifyToken(token, admin.sessionSecret);
  if (!session || session.username !== admin.username) {
    return res.status(401).json({ error: "Not logged in." });
  }
  next();
}

// ---------------------------------------------------------------
// App setup
// ---------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Public site + admin panel static files
app.use(express.static(PUBLIC_DIR));

// ---------------------------------------------------------------
// Image uploads
// ---------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".jpg";
    const name = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif|svg\+xml)/.test(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed."), ok);
  }
});

app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image received." });
  res.json({ url: `/assets/uploads/${req.file.filename}` });
});

// ---------------------------------------------------------
// Video uploads (separate from image uploads: different file
// types allowed, and a larger size limit since video files are
// bigger). Used for demo/intro videos and case study videos.
// ---------------------------------------------------------
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const safeExt = [".mp4", ".webm", ".ogg", ".mov"].includes(ext) ? ext : ".mp4";
    const name = `vid-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    cb(null, name);
  }
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
  fileFilter: (req, file, cb) => {
    const ok = /video\/(mp4|webm|ogg|quicktime)/.test(file.mimetype);
    cb(ok ? null : new Error("Only video files are allowed (mp4, webm, ogg, mov)."), ok);
  }
});

app.post("/api/upload-video", requireAuth, (req, res) => {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Video upload failed." });
    if (!req.file) return res.status(400).json({ error: "No video received." });
    res.json({ url: `/assets/uploads/${req.file.filename}` });
  });
});

// ---------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = readAdmin();
  if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
  if (username !== admin.username || !bcrypt.compareSync(password, admin.passwordHash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = signToken({ username: admin.username, exp: Date.now() + SESSION_TTL_MS }, admin.sessionSecret);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS
  });
  res.json({ ok: true, mustChangePassword: !!admin.mustChangePassword });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const admin = readAdmin();
  const token = req.cookies[SESSION_COOKIE];
  const session = verifyToken(token, admin.sessionSecret);
  res.json({
    loggedIn: !!session,
    username: admin.username,
    mustChangePassword: !!admin.mustChangePassword
  });
});

app.post("/api/change-password", requireAuth, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  const admin = readAdmin();
  if (!currentPassword || !bcrypt.compareSync(currentPassword, admin.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  if (newUsername && newUsername.trim()) admin.username = newUsername.trim();
  if (newPassword && newPassword.trim()) {
    if (newPassword.trim().length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    admin.passwordHash = bcrypt.hashSync(newPassword.trim(), 10);
  }
  admin.mustChangePassword = false;
  // Rotate the session secret so old sessions/tokens are invalidated.
  admin.sessionSecret = crypto.randomBytes(32).toString("hex");
  writeAdmin(admin);

  const token = signToken({ username: admin.username, exp: Date.now() + SESSION_TTL_MS }, admin.sessionSecret);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: SESSION_TTL_MS });
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Content — read (public, the live site needs this) and write
// (protected, only the Admin Panel can save changes)
// ---------------------------------------------------------------
app.get("/api/content", (req, res) => {
  res.json(readJSON(CONTENT_FILE));
});

app.get("/api/themes", (req, res) => {
  res.json(readJSON(THEMES_FILE));
});

app.put("/api/theme", requireAuth, (req, res) => {
  const { theme } = req.body || {};
  const themes = readJSON(THEMES_FILE);
  if (!theme || !themes[theme]) return res.status(400).json({ error: "Unknown theme." });
  const content = readJSON(CONTENT_FILE);
  content.theme = theme;
  writeJSON(CONTENT_FILE, content);
  res.json({ ok: true, theme });
});

app.put("/api/pages/:page", requireAuth, (req, res) => {
  const content = readJSON(CONTENT_FILE);
  const page = req.params.page;
  if (!content.pages[page]) return res.status(404).json({ error: "Unknown page." });
  content.pages[page] = { ...content.pages[page], ...req.body };
  writeJSON(CONTENT_FILE, content);
  res.json({ ok: true, page: content.pages[page] });
});

app.put("/api/contact", requireAuth, (req, res) => {
  const content = readJSON(CONTENT_FILE);
  const { email, social } = req.body || {};
  if (email !== undefined) content.contact.email = email;
  if (social) content.contact.social = { ...content.contact.social, ...social };
  writeJSON(CONTENT_FILE, content);
  res.json({ ok: true, contact: content.contact });
});

// ---------------------------------------------------------------
// Generic CRUD helper for services / founders / caseStudies arrays
// ---------------------------------------------------------------
function crudRoutes(key, idPrefix) {
  app.post(`/api/${key}`, requireAuth, (req, res) => {
    const content = readJSON(CONTENT_FILE);
    const item = { ...req.body, id: `${idPrefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}` };
    content[key].push(item);
    writeJSON(CONTENT_FILE, content);
    res.json({ ok: true, item });
  });

  app.put(`/api/${key}/:id`, requireAuth, (req, res) => {
    const content = readJSON(CONTENT_FILE);
    const idx = content[key].findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found." });
    content[key][idx] = { ...content[key][idx], ...req.body, id: content[key][idx].id };
    writeJSON(CONTENT_FILE, content);
    res.json({ ok: true, item: content[key][idx] });
  });

  app.delete(`/api/${key}/:id`, requireAuth, (req, res) => {
    const content = readJSON(CONTENT_FILE);
    const before = content[key].length;
    content[key] = content[key].filter((x) => x.id !== req.params.id);
    if (content[key].length === before) return res.status(404).json({ error: "Not found." });
    writeJSON(CONTENT_FILE, content);
    res.json({ ok: true });
  });

  // Support reordering (used by the admin drag-free "move up/down" controls)
  app.put(`/api/${key}-reorder`, requireAuth, (req, res) => {
    const { order } = req.body || {};
    const content = readJSON(CONTENT_FILE);
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array of ids." });
    const byId = Object.fromEntries(content[key].map((x) => [x.id, x]));
    const reordered = order.map((id) => byId[id]).filter(Boolean);
    // Keep any items not mentioned (safety net) appended at the end
    content[key].forEach((x) => {
      if (!order.includes(x.id)) reordered.push(x);
    });
    content[key] = reordered;
    writeJSON(CONTENT_FILE, content);
    res.json({ ok: true });
  });
}

crudRoutes("services", "svc");
crudRoutes("founders", "f");
crudRoutes("caseStudies", "cs");

// ---------------------------------------------------------------
// Fallback: SPA-style admin panel routing (so /admin/anything works)
// ---------------------------------------------------------------
app.get("/admin*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NodeCraft Automation site running at http://localhost:${PORT}`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin`);
});
