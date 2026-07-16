import express from "express";
import cors from "cors";
import { kv } from "@vercel/kv";

const app = express();
app.use(express.json());
app.use(cors());

// 1. Qurilmani tekshirish va ro'yxatdan o'tkazish
app.post("/api/register", async (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) return res.status(400).json({ error: "Qurilma ID si yo'q" });

  try {
    // Vercel KV bazasidan foydalanuvchilarni olamiz
    let users = (await kv.get("users")) || [];
    let user = users.find((u) => u.deviceId === deviceId);
    const now = new Date();

    if (!user) {
      user = {
        deviceId,
        deviceName,
        createdAt: now.toISOString(),
        isBlocked: false,
      };
      users.push(user);
      await kv.set("users", users); // Yangi ro'yxatni saqlaymiz
    }

    const createdDate = new Date(user.createdAt);
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = diffDays > 30;

    res.json({
      deviceId: user.deviceId,
      isBlocked: user.isBlocked,
      isExpired: isExpired,
      daysUsed: diffDays,
      daysLeft: Math.max(0, 30 - diffDays),
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Baza bilan ulanishda xatolik: " + error.message });
  }
});

// 2. Admin uchun barcha foydalanuvchilarni olish
app.get("/api/users", async (req, res) => {
  try {
    const users = (await kv.get("users")) || [];
    const now = new Date();

    const formattedUsers = users.map((user) => {
      const createdDate = new Date(user.createdAt);
      const diffTime = Math.abs(now - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        ...user,
        daysLeft: Math.max(0, 30 - diffDays),
        isExpired: diffDays > 30,
      };
    });

    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ error: "Xatolik: " + error.message });
  }
});

// 3. Admin orqali qurilmani bloklash / ochish
app.post("/api/block", async (req, res) => {
  const { deviceId, isBlocked } = req.body;
  try {
    let users = (await kv.get("users")) || [];
    let user = users.find((u) => u.deviceId === deviceId);

    if (user) {
      user.isBlocked = isBlocked;
      await kv.set("users", users); // O'zgarishni bazada yangilaymiz
      res.json({
        success: true,
        message: `Holat o'zgardi. Blok: ${isBlocked}`,
      });
    } else {
      res.status(404).json({ error: "Foydalanuvchi topilmadi" });
    }
  } catch (error) {
    res.status(500).json({ error: "Xatolik: " + error.message });
  }
});

// Mahalliy tekshirish uchun (Vercel-dan tashqarida ham ishlab turishi uchun)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} portida ishga tushdi`);
});

export default app;
