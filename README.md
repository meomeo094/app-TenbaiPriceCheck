# PriceCheck - Kiểm tra giá thu mua Nhật Bản

App PWA để quét mã JAN và so sánh giá thu mua từ 3 trang web Nhật Bản.

## Cấu trúc dự án

```
PriceCheck/
├── frontend/     → Next.js 16 + PWA (deploy lên Vercel)
└── backend/      → Express.js + Playwright (chạy Local)
```

## Chạy dự án

### Backend (Local)
```bash
cd backend
npm install
node server.js
```
→ Server chạy tại `http://localhost:3001`

### Frontend (Development)
```bash
cd frontend
npm install
npm run dev
```
→ App chạy tại `http://localhost:3000`

### Frontend (Build cho Vercel)
```bash
cd frontend
npm run build
```

## Cấu hình Ngrok (khi dùng Vercel)

1. Cài Ngrok: https://ngrok.com
2. Chạy: `ngrok http 3001`
3. Copy URL Ngrok (vd: `https://abc123.ngrok-free.app`)
4. Cập nhật `frontend/.env.local` (hoặc biến trên Vercel):
   ```
   NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
   ```
5. Redeploy lên Vercel

## API Backend

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `GET /` | GET | Health check |
| `GET /api/check-price?jan=[CODE]` | GET | Kiểm tra giá theo mã JAN |

### Ví dụ response:
```json
{
  "jan": "4902370553024",
  "results": [
    {"site": "GameKaitori", "price": "75200", "link": "...", "status": "success"},
    {"site": "1-chome", "price": "45200", "link": "...", "status": "success"},
    {"site": "KaitoriShouten", "price": null, "link": "...", "status": "not_found"}
  ],
  "timestamp": "2026-04-04T00:00:00.000Z"
}
```

## Cài đặt PWA lên iPhone

1. Mở Safari trên iPhone
2. Truy cập URL của app (Vercel hoặc ngrok)
3. Nhấn nút **Share** (hình vuông có mũi tên lên)
4. Chọn **"Add to Home Screen"** (Thêm vào màn hình chính)
5. App sẽ chạy toàn màn hình như native app

## Lưu ý kỹ thuật

- **Anti-bot**: Sử dụng `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **Song song**: 3 trang được cào đồng thời với `Promise.all`
- **Memory**: Mỗi request dùng 1 browser instance, đóng sau khi xong
- **KaitoriShouten**: Trang dùng CSS sprite để mã hóa giá - đang phát triển decoder
