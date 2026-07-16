const { createClient } = require('@supabase/supabase-client');

// Supabase ulanish kalitlari (Vercel avtomatik bergan o'zgaruvchilardan o'qiydi)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // CORS sozlamalari (Admin panel va Flutter bemalol ulanishi uchun)
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

    const { url, method, body } = req;

    try {
        // 1. GET /api/users — Barcha foydalanuvchilarni olish (Admin panel uchun)
        if (url === '/api/users' && method === 'GET') {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Har bir foydalanuvchi uchun qolgan kunlarni hisoblab qo'shamiz
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

        // 2. POST /api/register — Qurilmani tekshirish / ro'yxatdan o'tkazish (Flutter uchun)
        if (url === '/api/register' && method === 'POST') {
            const { deviceId, deviceName } = body;

            if (!deviceId) {
                return res.status(400).json({ error: "deviceId kiritilishi shart!" });
            }

            // Avval bazada bormi tekshiramiz
            let { data: user, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('deviceId', deviceId)
                .single();

            // Agar foydalanuvchi topilmasa, yangi yaratamiz
            if (!user) {
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert([{ deviceId, deviceName }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                user = newUser;
            }

            // Kunlarni hisoblash logikasi (30 kunlik sinov muddati)
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

        // 3. POST /api/block — Qurilmani bloklash yoki ochish (Admin panel uchun)
        if (url === '/api/block' && method === 'POST') {
            const { deviceId, isBlocked } = body;

            const { data, error } = await supabase
                .from('users')
                .update({ isBlocked: isBlocked })
                .eq('deviceId', deviceId)
                .select();

            if (error) throw error;

            return res.status(200).json({ success: true, data });
        }

        // Agar noto'g'ri API manzilga murojaat qilinsa
        return res.status(404).json({ error: "Sahifa topilmadi" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server xatosi: " + err.message });
    }
};
