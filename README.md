# ENGLISH LITTLE WORLD — V2 Platform

Nền tảng học tiếng Anh trực tuyến cho trẻ 3–11 tuổi (**Learn • Play • Speak • Grow**), kế thừa và nâng cấp trực tiếp từ mã nguồn V1 trên React + TypeScript + Vite + Vercel Serverless Functions + Supabase + Gemini AI + MoMo.

---

## 1. Kiến trúc hệ thống (Kế thừa V1 → V2)

- **Frontend SPA**: React 18 + TypeScript + Vite + PWA (`/logo-evui.png`, `manifest.json`, `sw.js`) + iOS Safari Web Speech API (`src/utils/speech.ts`).
- **Backend Proxy Serverless (Vercel `/api/*` + `server.ts` cho môi trường dev)**:
  - `POST /api/ai/buddy`: Trợ lý AI English Buddy (Text + Audio) dùng `@google/genai` (`gemini-4-hydrogen`, `gemini-3.5-transcribe`, `gemini-3.8-flash-lite-tts`), khóa chủ đề theo bài học, chặn thông tin cá nhân (PII), kiểm tra quyền phụ huynh & giới hạn lượt/ngày.
  - `POST /api/ai/pronunciation`: Phân tích phát âm theo hướng động viên (không bịa đặt điểm số khoa học/CEFR), lưu metadata tham khảo (không lưu tệp ghi âm của trẻ).
  - `POST /api/momo/create-payment`, `POST /api/momo/ipn`, `GET /api/momo/status`: Tích hợp MoMo API v2 ký HMAC-SHA256, xác thực IPN chống trùng lặp (`order_id` unique) và chỉ kích hoạt gói sau xác thực phía server.
- **Database & RLS (Supabase)**:
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/002_v2_platform_schema.sql`
  - `supabase/migrations/003_seed_plans_and_courses.sql`

---

## 2. Biến môi trường cần cấu hình (Trên Vercel & `.env.local`)

> Lưu ý: Không đưa bất kỳ khóa bí mật (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MOMO_SECRET_KEY`) nào vào mã frontend hoặc biến có tiền tố `VITE_`. Giữ nguyên các biến vận hành GitHub/Facebook hiện có trên Vercel.

| Biến | Phạm vi | Mục đích |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | URL dự án Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase Anon public key |
| `SUPABASE_URL` | Server (`/api/*`) | URL dự án Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (`/api/*`) | Service role key để xác thực JWT/AI quota/IPN MoMo |
| `GEMINI_API_KEY` | Server (`/api/*`) | Khóa Gemini API |
| `MOMO_PARTNER_CODE` | Server (`/api/*`) | Mã đối tác MoMo merchant |
| `MOMO_ACCESS_KEY` | Server (`/api/*`) | Access key MoMo |
| `MOMO_SECRET_KEY` | Server (`/api/*`) | Secret key ký HMAC-SHA256 |
| `MOMO_ENDPOINT` | Server (`/api/*`) | Endpoint tạo thanh toán MoMo (sandbox/prod) |
| `MOMO_QUERY_ENDPOINT` | Server (`/api/*`) | Endpoint truy vấn trạng thái MoMo |
| `MOMO_RECURRING_APPROVED` | Server (`/api/*`) | Đặt `true` CHỈ khi MoMo đã cấp quyền Subscription API định kỳ; mặc định `false` (gia hạn thủ công) |
| `APP_BASE_URL` | Server (`/api/*`) | Domain chính thức (vd: `https://evui.tranhuutung.com`) |

---

## 3. Hướng dẫn cấu hình nhanh

### A. Supabase
1. Mở **SQL Editor** trên Supabase Dashboard.
2. Chạy lần lượt 3 file trong `supabase/migrations/`:
   - `001_initial_schema.sql`
   - `002_v2_platform_schema.sql`
   - `003_seed_plans_and_courses.sql`
3. Trong **Authentication → URL Configuration**, thêm Redirect URL: `https://<domain-cua-ban>/#/phu-huynh`.
4. Để cấp quyền biên tập CMS (`#/quan-tri`) cho tài khoản quản trị: cập nhật cột `role = 'admin'` cho dòng tương ứng trong bảng `public.parent_profiles` trực tiếp trên Supabase Table Editor. Sau đó đăng nhập và bấm **"Đồng bộ khung 320 bài lên Supabase"** trong trang Quản trị.

### B. Gemini API & MoMo
1. Thêm `GEMINI_API_KEY` trong Vercel → **Settings → Environment Variables**.
2. Đăng ký tài khoản MoMo Business / Test Sandbox, lấy `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`.
3. Cấu hình IPN URL: `https://<domain-cua-ban>/api/momo/ipn`.
4. Khi chưa được MoMo phê duyệt Recurring/Subscription API, giữ `MOMO_RECURRING_APPROVED=false` để vận hành theo phương thức gia hạn thủ công minh bạch.

### C. Deploy trên Vercel
1. Đẩy mã nguồn lên GitHub (`tranhuutungcom-code/evui`).
2. Vercel tự động chạy `npm run build` (`tsc -b && vite build`) để xuất `dist/` và triển khai toàn bộ thư mục `/api/*.ts` thành Vercel Serverless Functions.
3. Không sửa đổi hoặc xóa các biến `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` và các biến cấu hình Facebook đang hoạt động trên Vercel.

---

## 4. Chạy thử tại máy

```bash
npm install
npm run dev
```

Ứng dụng chạy cả Vite frontend và API routes trên cổng `3000`.
