/// GET /api/status?deviceId=...  yoki  POST /api/status { deviceId }
/// Joriy holatni qaytaradi va oxirgi faollik sanasini yangilaydi.
const { getUser, saveUser, toStatus, setCors, readBody } = require("./_lib");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const deviceId =
    req.method === "GET" ? req.query.deviceId : (await readBody(req)).deviceId;

  const user = await getUser(deviceId);
  if (!user) return res.status(404).json({ error: "not_found" });

  // Oxirgi faollik sanasini yangilash (har 1 soatda bir marta yozish yetarli).
  const hourAgo = Date.now() - 3600000;
  if (new Date(user.lastActiveAt).getTime() < hourAgo) {
    user.lastActiveAt = new Date().toISOString();
    await saveUser(user);
  }

  return res.status(200).json(toStatus(user));
};
