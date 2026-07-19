const express = require('express');
const cors = require('cors');

const app = express();

// JSON ma'lumotlarni o'qish uchun ruxsat berish
app.use(express.json());

// CORS ruxsatnomalari (Admin panel va Flutter ilova muammosiz ulanishi uchun)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 1. GET /api/users — Admin Panel uchun barcha qurilmalarni olish
app.get('/api/users', async (req, res) => {
    try {
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

        // Ma'lumotlarni admin panel va Flutter formalariga moslash
        const processedUsers = data.map(user => {
            // Yaratilgan kundan boshlab 30 kunlik sinov muddatini hisoblash
            const cDate = new Date(user.created_at);
            cDate.setDate(cDate.getDate() + 30);

            return {
                id: user.id,
                deviceId: user.deviceId,
                deviceName: user.deviceName,
                name: "Foydalanuvchi #" + user.id, // jadvalda name yo'qligi uchun dinamik ID beramiz
                phone: "Kiritilmagan",
                trialEnd: cDate.toISOString(),
                blocked: user.isBlocked ?? false // bazadagi 'isBlocked'ni 'blocked'ga o'giramiz
            };
        });

        return res.status(200).json(processedUsers);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. POST /api/register — Qurilmani ro'yxatdan o'tkazish (Flutter uchun)
app.post('/api/register', async (req, res) => {
    try {
        const { deviceId, deviceName } = req.body;

        if (!deviceId) {
            return res.status(400).json({ error: "deviceId kiritilishi shart!" });
        }

        // Avval bazadan qurilmani tekshiramiz
        const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const checkData = await checkRes.json();
        let user = checkData[0];

        // Agar qurilma bazada bo'lmasa, faqat bor ustunlar bilan yangi yaratamiz
        if (!user) {
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ 
                    deviceId: deviceId, 
                    deviceName: deviceName || 'Noma\'lum qurilma',
                    isBlocked: false
                })
            });

            if (!insertRes.ok) {
                const insertErr = await insertRes.text();
                throw new Error("Supabase Insert Error: " + insertErr);
            }

            const insertData = await insertRes.json();
            user = insertData[0];
        }

        // Sinov muddati tugashini hisoblash (created_at + 30 kun)
        const cDate = new Date(user.created_at || new Date());
        cDate.setDate(cDate.getDate() + 30);

        // FLUTTER ILOVANGIZ KUTAYOTGAN ANIQ FORMAT:
        return res.status(200).json({
            trialEnd: cDate.toISOString(),
            blocked: user.isBlocked ?? false
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 3. GET /api/status — Qurilma holatini tekshirish (Flutter uchun)
app.get('/api/status', async (req, res) => {
    try {
        const { deviceId } = req.query;

        if (!deviceId) {
            return res.status(400).json({ error: "deviceId shart!" });
        }

        const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const checkData = await checkRes.json();
        const user = checkData[0];

        if (!user) {
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            return res.status(200).json({ trialEnd: defaultDate.toISOString(), blocked: false });
        }

        const cDate = new Date(user.created_at);
        cDate.setDate(cDate.getDate() + 30);

        return res.status(200).json({
            trialEnd: cDate.toISOString(),
            blocked: user.isBlocked ?? false
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 4. POST /api/block — Qurilmani bloklash yoki ochish (Admin panel uchun)
app.post('/api/block', async (req, res) => {
    try {
        const { deviceId, blocked } = req.body;

        const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ 
                isBlocked: blocked // Sizning bazangizdagi aniq ustun nomi
            })
        });

        if (!updateRes.ok) {
            const updateErr = await updateRes.text();
            throw new Error("Supabase Update Error: " + updateErr);
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 5. DELETE /api/users/:deviceId — Qurilmani bazadan butunlay o'chirish (Admin panel uchun)
app.delete('/api/users/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;

        const deleteRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=representation'
            }
        });

        if (!deleteRes.ok) {
            const deleteErr = await deleteRes.text();
            throw new Error("Supabase Delete Error: " + deleteErr);
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
