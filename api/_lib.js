/// Umumiy yordamchi: foydalanuvchi (qurilma) yozuvlari bilan ishlash.
/// Vercel KV (Redis) dan foydalanadi - Vercel loyihasida KV store ulanishi
/// kerak (env o'zgaruvchilar: KV_REST_API_URL, KV_REST_API_TOKEN avtomatik
/// qo'shiladi).
const { kv } = require("@vercel/kv");

const KEY_PREFIX = "user:";
const TRIAL_DAYS = 7;

function key(deviceId) {
  return KEY_PREFIX + deviceId;
}

function newUser(data) {
  const now = new Date().toISOString();
  return {
    deviceId: data.deviceId,
    deviceName: data.deviceName || "Noma'lum qurilma",
    name: data.name || "",
    phone: data.phone || "",
    // Obuna tugash sanasi (ISO). Yangi foydalanuvchi - TRIAL_DAYS kunlik sinov.
    subscriptionEnd: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    blocked: false,
    // Admin o'chirgan yoki foydalanuvchi ilovadan o'chirgan belgisi.
    deleted: false,
    loggedOut: false,
    createdAt: now,
    lastActiveAt: now,
  };
}

async function getUser(deviceId) {
  if (!deviceId) return null;
  return (await kv.get(key(deviceId))) || null;
}

async function saveUser(user) {
  await kv.set(key(user.deviceId), user);
  return user;
}

/// Har bir so'rovda yangilash - yangi foydalanuvchi bo'lsa yaratadi.
async function getOrCreateUser(data) {
  const existing = await getUser(data.deviceId);
  if (existing) {
    existing.lastActiveAt = new Date().toISOString();
    if (data.name) existing.name = data.name;
    if (data.phone) existing.phone = data.phone;
    if (data.deviceName) existing.deviceName = data.deviceName;
    return saveUser(existing);
  }
  return saveUser(newUser(data));
}

/// Barcha foydalanuvchilar ro'yxati (admin panel uchun).
async function listUsers() {
  const keys = await kv.keys(KEY_PREFIX + "*");
  if (!keys.length) return [];
  const users = await kv.mget(...keys);
  return users
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/// Javob formati - Flutter DeviceStatus.fromJson shu formatni kutadi.
function toStatus(user) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(user.subscriptionEnd) - Date.now()) / 86400000),
  );
  return {
    deviceId: user.deviceId,
    name: user.name,
    phone: user.phone,
    deviceName: user.deviceName,
    subscriptionEnd: user.subscriptionEnd,
    daysLeft,
    blocked: !!user.blocked,
    deleted: !!user.deleted,
    loggedOut: !!user.loggedOut,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
  };
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

module.exports = {
  kv,
  getUser,
  saveUser,
  getOrCreateUser,
  listUsers,
  toStatus,
  setCors,
  readBody,
  newUser,
};
