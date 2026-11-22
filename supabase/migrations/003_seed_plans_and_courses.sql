-- Idempotent Seed for English Little World V2
-- Seeds default membership plans (configurable in DB) and 4x8 courses/units structure.
-- Safe to run multiple times without duplicating data.

insert into public.plans (id, name, tagline, price_vnd, billing_cycle, max_children, ai_daily_limit, features, is_active, sort_order)
values
  (
    'free',
    'Gói Miễn Phí (Starter)',
    'Trải nghiệm nền tảng nghe – nói tự nhiên cùng bé',
    0,
    'free',
    1,
    5,
    '["Truy cập các bài học mẫu đã xuất bản ở 4 cấp độ", "Tối đa 1 hồ sơ trẻ và lưu tiến độ học tập", "Nghe phát âm chuẩn & tốc độ chậm cho trẻ", "5 lượt luyện tập AI English Buddy mỗi ngày (khi phụ huynh bật)"]'::jsonb,
    true,
    1
  ),
  (
    'premium',
    'Gói Thành Viên (Premium)',
    'Mở khóa đầy đủ lộ trình học cho 1–2 bé',
    149000,
    'monthly',
    2,
    30,
    '["Truy cập toàn bộ bài học đã xuất bản (lộ trình 320 bài)", "Tối đa 2 hồ sơ trẻ riêng biệt", "30 lượt AI English Buddy & Luyện phát âm mỗi ngày", "Báo cáo chi tiết theo Unit và lịch sử làm bài"]'::jsonb,
    true,
    2
  ),
  (
    'family',
    'Gói Gia Đình (Family)',
    'Đồng hành dài lâu cho cả nhà nhiều bé',
    249000,
    'monthly',
    5,
    60,
    '["Toàn quyền truy cập mọi cấp độ L1–L4 đã xuất bản", "Quản lý tới 5 hồ sơ trẻ độc lập", "60 lượt AI English Buddy & Luyện phát âm mỗi ngày", "Ưu tiên nội dung mới và hoạt động ôn tập mở rộng"]'::jsonb,
    true,
    3
  )
on conflict (id) do nothing;

insert into public.courses (id, name, age_label, age_range, description, goal, color, emoji, sort_order)
values
  ('L1', 'Little Explorers', '3–4 tuổi', 'Mầm non', 'Làm quen âm thanh, từ đơn quen thuộc qua trò chơi chạm nghe trực quan.', 'Nghe quen tai, vui vẻ làm quen và bắt chước âm thanh, không ép đọc viết.', 'peach', '🐣', 1),
  ('L2', 'Little Learners', '5–6 tuổi', 'Tiền tiểu học', 'Mở rộng vốn từ gần gũi, câu giao tiếp ngắn và nhận biết phonics cơ bản.', 'Chào hỏi, gọi tên đồ vật quen thuộc và phản xạ câu ngắn tự nhiên.', 'yellow', '🦊', 2),
  ('L3', 'Young Learners', '7–9 tuổi', 'Tiểu học đầu', 'Xây dựng câu hoàn chỉnh, nghe hiểu hội thoại ngắn và đọc hiểu đơn giản.', 'Kể được các hoạt động hằng ngày theo trình tự và hỏi đáp cơ bản.', 'green', '🐼', 3),
  ('L4', 'Junior English', '10–11 tuổi', 'Tiểu học lớn', 'Hội thoại thực tế, đọc hiểu đoạn ngắn và diễn đạt ý kiến kèm lý do.', 'Tham gia hội thoại phù hợp độ tuổi và trình bày suy nghĩ tự tin.', 'purple', '🦁', 4)
on conflict (id) do nothing;
