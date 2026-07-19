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

// 1. GET /api/users — Barcha foydalanuvchilarni Admin Panel uchun olish
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

        // Admin panelga qulay bo'lishi uchun joriy ma'lumotlarni qayta ishlaymiz
        const processedUsers = data.map(user => {
            // Agar bazada trialEnd bo'lsa o'shani oladi, bo'lmasa yaratilgan sanaga 30 kun qo'shadi
            let trialEndStr = user.trialEnd;
            if (!trialEndStr) {
                const cDate = new Date(user.created_at);
                cDate.setDate(cDate.getDate() + 30);
                trialEndStr = cDate.toISOString();
            }

            return {
                ...user,
                trialEnd: trialEndStr,
                // Flutter'dagi kabi 'blocked' (isBlocked emas) maydonini qo'llaymiz
                blocked: user.blocked ?? user.isBlocked ?? false 
            };
        });

        return res.status(200).json(processedUsers);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. POST /api/register — Qurilmani ism va telefon bilan ro'yxatdan o'tkazish (Flutter uchun)
app.post('/api/register', async (req, res) => {
    try {
        const { name, phone, deviceId, deviceName } = req.body;

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

        // Agar qurilma bazada bo'lmasa, yangi yaratamiz (30 kunlik sinov muddati bilan)
        if (!user) {
            const tEnd = new Date();
            tEnd.setDate(tEnd.getDate() + 30); // 30 kun qo'shish

            const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ 
                    deviceId, 
                    deviceName, 
                    name: name || '', 
                    phone: phone || '',
                    trialEnd: tEnd.toISOString(),
                    blocked: false
                })
            });

            if (!insertRes.ok) {
                const insertErr = await insertRes.text();
                throw new Error("Supabase Insert Error: " + insertErr);
            }

            const insertData = await insertRes.json();
            user = insertData[0];
        }

        // Agar trialEnd hali belgilanmagan bo'lsa (eski foydalanuvchilar uchun)
        let finalTrialEnd = user.trialEnd;
        if (!finalTrialEnd) {
            const cDate = new Date(user.created_at);
            cDate.setDate(cDate.getDate() + 30);
            finalTrialEnd = cDate.toISOString();
        }

        // FLUTTER KUTAYOTGAN ANIQ KONTRAKT JAVOBI:
        return res.status(200).json({
            trialEnd: finalTrialEnd,
            blocked: user.blocked ?? user.isBlocked ?? false
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
            // Agar foydalanuvchi topilmasa, xavfsiz default qiymat qaytaramiz
            const defaultDate = new Date();
            return res.status(200).json({ trialEnd: defaultDate.toISOString(), blocked: false });
        }

        let finalTrialEnd = user.trialEnd;
        if (!finalTrialEnd) {
            const cDate = new Date(user.created_at);
            cDate.setDate(cDate.getDate() + 30);
            finalTrialEnd = cDate.toISOString();
        }

        // FLUTTER KUTAYOTGAN ANIQ KONTRAKT JAVOBI:
        return res.status(200).json({
            trialEnd: finalTrialEnd,
            blocked: user.blocked ?? user.isBlocked ?? false
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

        // Ikkala maydonni ham (eski va yangi) yangilab ketamiz, xatolik bo'lmasligi uchun
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ 
                blocked: blocked,
                isBlocked: blocked 
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda...`);
});

module.exports = app;
