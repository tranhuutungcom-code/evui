# ENGLISH LITTLE WORLD — MVP starter

Bộ khởi tạo website học tiếng Anh cho trẻ 3–11 tuổi. Đây là **MVP kỹ thuật và nội dung mẫu**, không phải sản phẩm đã được kiểm định sư phạm/pháp lý hoặc nền tảng production.

## 1. Công nghệ
- React + TypeScript + Vite
- Responsive CSS, Lucide icons
- Supabase (schema khởi tạo trong `supabase/migrations`)
- Web Speech API để thử phát âm/nhận diện giọng nói trên trình duyệt tương thích

## 2. Chạy thử tại máy
1. Cài Node.js bản LTS.
2. Giải nén thư mục.
3. Mở terminal tại thư mục dự án, chạy:
   ```bash
   npm install
   npm run dev
   ```
4. Mở URL Vite hiển thị trong terminal.

## 3. Đưa lên Lovable
Lovable phù hợp để tiếp tục dựng giao diện, kết nối Supabase và bổ sung chức năng. Có thể đưa mã nguồn vào GitHub rồi import repository trong Lovable. Nếu dùng prompt trong Lovable, yêu cầu giữ React + TypeScript, giữ cấu trúc nội dung và không tự ý tạo chức năng AI giả.

Prompt gợi ý:
> Tiếp tục phát triển dự án English Little World từ mã nguồn hiện tại. Giữ React + TypeScript + Vite. Kết nối Supabase theo schema hiện có. Xây dựng đăng ký/đăng nhập phụ huynh, tạo hồ sơ trẻ, lưu tiến độ bài học theo child_id, trang quản trị nội dung có phân quyền. Bắt buộc bật và kiểm thử RLS. Không đưa service role key hoặc khóa AI vào frontend. Không lưu bản ghi giọng nói trẻ nếu chưa có đồng ý rõ ràng của phụ huynh. Tách nội dung bài học khỏi giao diện để có thể mở rộng lên 320 bài.

## 4. Kết nối Supabase
1. Tạo project Supabase.
2. Chạy file `supabase/migrations/001_initial_schema.sql` trong SQL Editor.
3. Tạo `.env` từ `.env.example`, điền Project URL và anon key.
4. Lưu ý: bản giao diện hiện tại vẫn chạy bằng dữ liệu mẫu trong `src/data.ts`. Cần phát triển lớp repository/API để đọc và ghi dữ liệu Supabase; schema SQL không tự động kết nối UI.

## 5. Phạm vi hiện tại
- Trang chủ, giới thiệu phương pháp và bốn cấp độ.
- Danh sách bài mẫu: 4 bài/cấp độ (16 bài mẫu).
- Màn hình bài học: phát âm mẫu bằng SpeechSynthesis, nút nhận diện giọng nói nếu browser hỗ trợ, đánh dấu hoàn thành trong state của phiên.
- Trang phụ huynh: thống kê demo trên thiết bị/phiên hiện tại.
- SQL khởi tạo cho phụ huynh, trẻ, bài học, tiến độ và consent.

## 6. Chưa có — cần làm trước khi thương mại hóa
- Đăng ký/đăng nhập, xác minh email, quên mật khẩu.
- Lưu tiến độ thực tế vào Supabase; đồng bộ nhiều thiết bị.
- CMS/admin hoàn chỉnh, upload ảnh/audio, quy trình biên tập và duyệt bài.
- AI hội thoại có kiểm soát, proxy backend/Edge Function và giới hạn chi phí.
- Chấm phát âm có căn cứ sư phạm. Web Speech API chỉ cho transcript tham khảo, không phải thang điểm phát âm đáng tin cậy.
- Thanh toán, gói miễn phí/trả phí, hóa đơn và quản lý thuê bao.
- Kiểm thử bảo mật, accessibility, hiệu năng, backup, monitoring.
- Rà soát pháp lý tại Việt Nam về dữ liệu cá nhân và dữ liệu trẻ em, cơ chế đồng ý của cha mẹ/người giám hộ, chính sách lưu/xóa dữ liệu.

## 7. Nguyên tắc nội dung
Mục tiêu tuổi là định hướng, không phải cam kết đầu ra. Nên có bài kiểm tra đầu vào nhẹ, lộ trình linh hoạt, giáo viên/biên tập viên tiếng Anh duyệt nội dung và thử nghiệm với trẻ thật trước khi phát hành.
