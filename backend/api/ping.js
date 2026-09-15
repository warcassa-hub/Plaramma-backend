/// POST /api/ping  { deviceId }
/// Foydalanuvchi ilovada faol bo'lganini belgilaydi (lastActiveAt) va
/// holatni qaytaradi. Ilova davriy ravishda chaqiradi.
const { getUser, saveUser, toStatus, setCors, readBody } = require("./_lib");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });

  const body = await readBody(req);
  const user = await getUser(body.deviceId);
  if (!user) return res.status(404).json({ error: "not_found" });

  user.lastActiveAt = new Date().toISOString();
  await saveUser(user);

  return res.status(200).json(toStatus(user));
};
