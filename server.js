const express = require('express');
const cors = require('cors');

const app = express();

// JSON ma'lumotlarni o'qish uchun ruxsat berish
app.use(express.json());

// CORS ruxsatnomalari (Admin panel va Flutter ilova muammosiz ulanishi uchun)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 1. GET /api/users — Foydalanuvchilarni olish
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
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. POST /api/register — Qurilmani ro'yxatdan o'tkazish/tekshirish
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

        // Agar qurilma bazada bo'lmasa, yangi yaratamiz
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
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 3. POST /api/block — Qurilmani bloklash yoki ochish
app.post('/api/block', async (req, res) => {
    try {
        const { deviceId, isBlocked } = req.body;

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
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// Serverni portga ulash (mahalliy testlar uchun va Vercel uchun moslashuvchan)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda...`);
});

module.exports = app;
