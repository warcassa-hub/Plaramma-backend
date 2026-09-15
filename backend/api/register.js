/// POST /api/register  { name, phone, deviceId, deviceName }
/// Ro'yxatdan o'tkazadi (yoki mavjud qurilmani qayta faollashtiradi).
const { getOrCreateUser, toStatus, setCors, readBody } = require("./_lib");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });

  const body = await readBody(req);
  const { name, phone, deviceId, deviceName } = body;
  if (!deviceId || !name || !phone) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const user = await getOrCreateUser({
    deviceId,
    deviceName,
    name,
    phone,
    // Qayta ro'yxatdan o'tish = qayta kirish; "loggedOut" belgisini tozalaymiz.
    loggedOut: false,
  });

  // O'chirilgan yoki bloklangan foydalanuvchini qayta kiritmaymiz.
  if (user.deleted || user.blocked) {
    return res.status(403).json({
      ...toStatus(user),
      blocked: user.blocked || user.deleted,
    });
  }

  return res.status(200).json(toStatus(user));
};
