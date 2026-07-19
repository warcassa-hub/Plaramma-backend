const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 1. GET /api/users
app.get('/api/users', async (req, res) => {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (!response.ok) throw new Error("Supabase Fetch Error");
        const data = await response.json();

        const processedUsers = data.map(user => {
            const cDate = new Date(user.created_at);
            cDate.setDate(cDate.getDate() + 7); // 7 KUNLIK QILINDI

            return {
                id: user.id,
                deviceId: user.deviceId,
                deviceName: user.deviceName || "Noma'lum qurilma",
                name: user.name || "Ismsiz Foydalanuvchi",
                phone: user.phone || "Kiritilmagan",
                trialEnd: cDate.toISOString(),
                blocked: user.isBlocked ?? false
            };
        });
        return res.status(200).json(processedUsers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, phone, deviceId, deviceName } = req.body;
        if (!deviceId) return res.status(400).json({ error: "deviceId shart!" });

        const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}&select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const checkData = await checkRes.json();
        let user = checkData[0];

        if (!user) {
            const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ deviceId, deviceName, name, phone, isBlocked: false })
            });
            if (!insertRes.ok) throw new Error("Insert Error");
            const insertData = await insertRes.json();
            user = insertData[0];
        }

        const cDate = new Date(user.created_at || new Date());
        cDate.setDate(cDate.getDate() + 7); // 7 KUNLIK QILINDI

        return res.status(200).json({
            trialEnd: cDate.toISOString(),
            blocked: user.isBlocked ?? false
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. GET /api/status
app.get('/api/status', async (req, res) => {
    try {
        const { deviceId } = req.query;
        if (!deviceId) return res.status(400).json({ error: "deviceId shart!" });

        const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}&select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const checkData = await checkRes.json();
        const user = checkData[0];

        if (!user) {
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 7); // 7 KUNLIK QILINDI
            return res.status(200).json({ trialEnd: defaultDate.toISOString(), blocked: false });
        }

        const cDate = new Date(user.created_at);
        cDate.setDate(cDate.getDate() + 7); // 7 KUNLIK QILINDI

        return res.status(200).json({
            trialEnd: cDate.toISOString(),
            blocked: user.isBlocked ?? false
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. POST /api/block
app.post('/api/block', async (req, res) => {
    try {
        const { deviceId, blocked } = req.body;
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isBlocked: blocked })
        });
        if (!updateRes.ok) throw new Error("Update Error");
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. DELETE /api/users/:deviceId
app.delete('/api/users/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const deleteRes = await fetch(`${supabaseUrl}/rest/v1/users?deviceId=eq.${encodeURIComponent(deviceId)}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (!deleteRes.ok) throw new Error("Delete Error");
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
