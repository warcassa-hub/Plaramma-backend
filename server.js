// FAQAT SUPABASE REST API BILAN ISHLAYDIGAN SERVER KODI
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
    // CORS ruxsatnomalari (Admin panel va Flutter uchun)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Vercel-da url ko'pincha so'rov yo'lini o'z ichiga oladi, uni tozalab olamiz
    const cleanUrl = req.url.split('?')[0];

    try {
        // 1. GET /api/users — Foydalanuvchilarni olish
        if (cleanUrl === '/api/users' && req.method === 'GET') {
            const response = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Supabase Fetch Error: " + errText);
            }

            const data = await response.json();

            // Kunlarni hisoblash
            const usersWithDays = data.map(user => {
                const createdDate = new Date(user.created_at);
                const today = new Date();
                const diffTime = Math.abs(today - createdDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const daysLeft = Math.max(0, 30 - diffDays);
                const isExpired = diffDays >= 30;

                return {
                    ...user,
                    daysLeft,
                    isExpired
                };
            });

            return res.status(200).json(usersWithDays);
        }

        // 2. POST /api/register — Qurilmani tekshirish/qo'shish
        if (cleanUrl === '/api/register' && req.method === 'POST') {
            const { deviceId, deviceName } = req.body || {};

            if (!deviceId) {
                return res.status(400).json({ error: "deviceId kiritilishi shart!" });
            }

            // Birinchi navbatda tekshiramiz
            const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}&select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            const checkData = await checkRes.json();
            let user = checkData[0];

            // Agar bazada yo'q bo'lsa, yangi qo'shamiz
            if (!user) {
                const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ deviceId, deviceName })
                });

                if (!insertRes.ok) {
                    const insertErr = await insertRes.text();
                    throw new Error("Supabase Insert Error: " + insertErr);
                }

                const insertData = await insertRes.json();
                user = insertData[0];
            }

            // Kunlarni hisoblash
            const createdDate = new Date(user.created_at);
            const today = new Date();
            const diffTime = Math.abs(today - createdDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 30 - diffDays);
            const isExpired = diffDays >= 30;

            return res.status(200).json({
                deviceId: user.deviceId,
                deviceName: user.deviceName,
                isBlocked: user.isBlocked,
                isExpired: isExpired,
                daysUsed: diffDays,
                daysLeft: daysLeft
            });
        }

        // 3. POST /api/block — Qurilmani bloklash/ochish
        if (cleanUrl === '/api/block' && req.method === 'POST') {
            const { deviceId, isBlocked } = req.body || {};

            const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ isBlocked: isBlocked })
            });

            if (!updateRes.ok) {
                const updateErr = await updateRes.text();
                throw new Error("Supabase Update Error: " + updateErr);
            }

            const updateData = await updateRes.json();
            return res.status(200).json({ success: true, data: updateData });
        }

        return res.status(404).json({ error: "Sahifa topilmadi: " + cleanUrl });

    } catch (err) {
        console.error("Xatolik:", err.message);
        return res.status(500).json({ error: "Server xatosi: " + err.message });
    }
};
