# Parket Boshqaruv — Backend (Vercel)

Qurilma litsenziyasi, obuna va bloklashni boshqaruvchi serverless backend.

## Endpointlar

| Method   | URL                        | Tavsif                                                                                  |
| -------- | -------------------------- | --------------------------------------------------------------------------------------- |
| POST     | `/api/register`            | Ro'yxatdan o'tish `{ name, phone, deviceId, deviceName }` → yangi bo'lsa 7 kunlik sinov |
| GET      | `/api/status?deviceId=...` | Holat: obuna tugashi, qolgan kunlar, bloklanganlik, oxirgi faollik                      |
| POST     | `/api/ping`                | `{ deviceId }` — faollikni yangilaydi, holatni qaytaradi                                |
| POST     | `/api/logout`              | `{ deviceId }` — ilovadan chiqish belgisi                                               |
| GET/POST | `/api/admin`               | Admin panel (HTML). Parol: `ADMIN_PASSWORD` env                                         |

## Javob formati (barcha endpointlar uchun bir xil)

```json
{
  "deviceId": "...",
  "name": "...",
  "phone": "...",
  "deviceName": "...",
  "subscriptionEnd": "2026-01-01T00:00:00.000Z",
  "daysLeft": 12,
  "blocked": false,
  "deleted": false,
  "loggedOut": false,
  "lastActiveAt": "...",
  "createdAt": "..."
}
```

## Deploy qilish

1. Vercel'da yangi loyiha yarating va shu `backend/` papkasini ulang (yoki `vercel` CLI: `cd backend && vercel --prod`).
2. Vercel loyihasida **KV (Redis)** store yarating va ulang — `KV_REST_API_URL` va `KV_REST_API_TOKEN` env'lari avtomatik qo'shiladi.
3. Env o'zgaruvchi qo'shing: `ADMIN_PASSWORD` (admin panel paroli).
4. Deploy qiling. Admin panel: `https://<sizning-domain>/api/admin`
5. Flutter ilovada `lib/services/auth_service.dart` ichidagi `_baseUrl` ni yangi domainga o'zgartiring.

## Admin panel imkoniyatlari

- Foydalanuvchi ro'yxati: ism, telefon, qurilma nomi, obuna holati, oxirgi faollik
- Bloklash / tiklash
- +30 kun obuna berish / obunani o'chirish
- Foydalanuvchini o'chirish (`deleted`) — ilova keyingi tekshiruvda uni tashqariga chiqarib yuboradi
- Statistika: faol, bloklangan, jami
