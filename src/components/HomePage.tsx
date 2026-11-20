import {
  ArrowRight,
  BookOpen,
  Headphones,
  Mic,
  Play,
  ShieldCheck,
  Star,
} from 'lucide-react'
import type { Level } from '../types/curriculum'
import type { RouteState } from '../utils/router'

interface HomePageProps {
  levels: Level[]
  completedIds: string[]
  firstLessonId: string
  onNavigate: (route: RouteState) => void
}

export function HomePage({
  levels,
  completedIds,
  firstLessonId,
  onNavigate,
}: HomePageProps) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Nghe · Nói · Chơi · Lớn khôn</p>
          <h1>
            Mỗi ngày một chút,
            <br />
            <em>tiếng Anh lớn lên</em>
            <br />
            cùng con.
          </h1>
          <p className="hero-lead">
            Hành trình học tiếng Anh vui vẻ dành cho trẻ từ 3–11 tuổi — bắt đầu
            bằng việc lắng nghe, lớn lên cùng những câu nói và tự tin giao tiếp
            tự nhiên.
          </p>
          <div className="hero-buttons">
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate({ page: 'program' })}
            >
              <span>Khám phá chương trình</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                onNavigate({ page: 'lesson', lessonId: firstLessonId })
              }
            >
              <Play size={17} aria-hidden="true" />
              <span>Trải nghiệm bài học</span>
            </button>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Nội dung phân chia theo độ tuổi 3–11
            </span>
            <span>
              <Headphones size={17} aria-hidden="true" />
              Nghe và tương tác mỗi ngày
            </span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="book-illustration">
            <span lang="en">ABC</span>
            <div className="book-face">☺</div>
          </div>
          <div className="floating-card card-one">
            🔊 <b lang="en">Hello!</b>
          </div>
          <div className="floating-card card-two">
            ⭐ <span lang="en">Great job!</span>
          </div>
          <div className="plant">🌱</div>
        </div>
      </section>

      <section className="section intro-section">
        <div className="section-heading">
          <p className="eyebrow">Lộ trình bốn chặng đường</p>
          <h2>Con sẽ học được gì qua từng giai đoạn?</h2>
          <p>
            Độ tuổi là điểm khởi đầu. Phụ huynh nên chọn cấp độ theo khả năng
            hiện tại của trẻ, không chỉ dựa vào năm sinh.
          </p>
        </div>

        <div className="level-grid">
          {levels.map((level, index) => {
            const levelLessons = level.units.flatMap((u) => u.lessons)
            const doneCount = levelLessons.filter((l) =>
              completedIds.includes(l.id)
            ).length

            return (
              <button
                type="button"
                className={`level-card ${level.color}`}
                key={level.id}
                onClick={() =>
                  onNavigate({ page: 'program', levelId: level.id })
                }
              >
                <div className="level-card-top">
                  <span className="level-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="level-card-emoji" aria-hidden="true">
                    {level.emoji}
                  </span>
                </div>
                <span className="level-age">
                  {level.age} · {level.units.length} đơn vị
                </span>
                <h3>{level.name}</h3>
                <p>{level.goal}</p>
                <div className="level-card-foot">
                  <span className="card-link">
                    Xem bài học <ArrowRight size={15} aria-hidden="true" />
                  </span>
                  <span className="level-meta-count">
                    {doneCount}/{levelLessons.length} bài mẫu
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="section method-section">
        <div className="section-heading">
          <p className="eyebrow">Chu trình học tự nhiên</p>
          <h2>Nghe trước — nói sau — tự tin dần</h2>
        </div>

        <div className="method-grid">
          <div className="method-item">
            <span className="method-icon blue" aria-hidden="true">
              <Headphones />
            </span>
            <h3 lang="en">Listen</h3>
            <p>Nghe từ, câu và hội thoại ngắn với ngữ cảnh trực quan.</p>
          </div>
          <div className="method-item">
            <span className="method-icon coral" aria-hidden="true">
              <Mic />
            </span>
            <h3 lang="en">Speak</h3>
            <p>Bắt chước, nhắc lại và trả lời theo khả năng của trẻ.</p>
          </div>
          <div className="method-item">
            <span className="method-icon yellow-bg" aria-hidden="true">
              <BookOpen />
            </span>
            <h3 lang="en">Play</h3>
            <p>Ôn tập qua trò chơi tương tác, câu chuyện và thử thách nhỏ.</p>
          </div>
          <div className="method-item">
            <span className="method-icon green-bg" aria-hidden="true">
              <Star />
            </span>
            <h3 lang="en">Grow</h3>
            <p>Ghi nhận nỗ lực, theo dõi tiến bộ và học đều đặn.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <p className="eyebrow">Bắt đầu nhẹ nhàng</p>
          <h2>Khám phá thế giới tiếng Anh của con.</h2>
          <p>
            Chọn một bài học ngắn để trải nghiệm cách học của English Little
            World trên điện thoại, máy tính bảng hoặc máy tính.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => onNavigate({ page: 'program' })}
        >
          <span>Bắt đầu khám phá</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>
    </main>
  )
}
