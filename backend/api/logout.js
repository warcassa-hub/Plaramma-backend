/// POST /api/logout  { deviceId }
/// Foydalanuvchi ilovadan chiqdi (logout) - "loggedOut" belgilanadi.
/// Keyin qayta kirishga urinsa va obuna tugagan/bloklangan bo'lsa - kira olmaydi.
const { getUser, saveUser, toStatus, setCors, readBody } = require("./_lib");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });

  const { deviceId } = await readBody(req);
  const user = await getUser(deviceId);
  if (!user) return res.status(404).json({ error: "not_found" });

  user.loggedOut = true;
  user.lastActiveAt = new Date().toISOString();
  await saveUser(user);

  return res.status(200).json(toStatus(user));
};
