import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gauge,
  LockKeyhole,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react'
import { useSpeech } from '../hooks/useSpeech'
import type { Lesson, LessonLocation, Level, Unit } from '../types/curriculum'
import type { RouteState } from '../utils/router'
import type { SpeechRateMode } from '../utils/storage'
import { LessonActivity } from './LessonActivity'

interface LessonPageProps {
  level: Level
  unit: Unit
  lesson: Lesson
  prevLesson: LessonLocation | null
  nextLesson: LessonLocation | null
  isCompleted: boolean
  speechRate: SpeechRateMode
  onChangeSpeechRate: (mode: SpeechRateMode) => void
  onCompleteLesson: (lessonId: string) => void
  onNavigate: (route: RouteState) => void
}

export function LessonPage({
  level,
  unit,
  lesson,
  prevLesson,
  nextLesson,
  isCompleted,
  speechRate,
  onChangeSpeechRate,
  onCompleteLesson,
  onNavigate,
}: LessonPageProps) {
  const [completionBanner, setCompletionBanner] = useState('')
  const {
    speakingText,
    listening,
    transcript,
    speechNotice,
    micSupported,
    speak,
    speakSequence,
    startMic,
    stopAll,
    resetTranscript,
  } = useSpeech(speechRate)

  useEffect(() => {
    stopAll()
    resetTranscript()
    setCompletionBanner('')
  }, [lesson.id, stopAll, resetTranscript])

  const handleFinish = () => {
    onCompleteLesson(lesson.id)
    setCompletionBanner(
      'Tuyệt vời! Bài học đã được đánh dấu hoàn thành. Hãy khen bé vì đã cố gắng nhé!'
    )
  }

  return (
    <main className="content-page lesson-page">
      <div className="lesson-topbar-nav">
        <button
          type="button"
          className="back-link"
          onClick={() => onNavigate({ page: 'program', levelId: level.id })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Quay lại {level.name}</span>
        </button>

        <div className="lesson-step-nav">
          {prevLesson && (
            <button
              type="button"
              className="outline-btn"
              onClick={() =>
                onNavigate({ page: 'lesson', lessonId: prevLesson.lesson.id })
              }
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Bài trước</span>
            </button>
          )}
          {nextLesson && (
            <button
              type="button"
              className="outline-btn"
              onClick={() =>
                onNavigate({ page: 'lesson', lessonId: nextLesson.lesson.id })
              }
            >
              <span>Bài tiếp</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="lesson-top">
        <p className="eyebrow">
          {level.name} · {level.age} · {unit.title}
        </p>
        <h1 lang="en">{lesson.title}</h1>
        <p>{lesson.objective}</p>
        <div className="lesson-meta-line centered tabular-nums">
          <span>{lesson.duration}</span>
          <span aria-hidden="true">·</span>
          <span>{lesson.words.length} từ trọng tâm</span>
          <span aria-hidden="true">·</span>
          <span>{isCompleted ? 'Đã hoàn thành' : 'Đang học'}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={isCompleted ? 100 : 35}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${isCompleted ? 100 : 35}%` }} />
        </div>
      </div>

      <div className="lesson-workspace">
        <section className="lesson-main-card">
          <div className="lesson-section-head">
            <div>
              <p className="step-label">01 / Nghe &amp; Khám phá</p>
              <h2 lang="en">Let&apos;s listen together!</h2>
            </div>

            <div
              className="speed-toggle"
              role="group"
              aria-label="Chọn tốc độ đọc mẫu"
            >
              <Gauge size={15} aria-hidden="true" />
              <button
                type="button"
                className={speechRate === 'normal' ? 'active' : ''}
                aria-pressed={speechRate === 'normal'}
                onClick={() => onChangeSpeechRate('normal')}
              >
                Nghe chuẩn
              </button>
              <button
                type="button"
                className={speechRate === 'slow' ? 'active' : ''}
                aria-pressed={speechRate === 'slow'}
                onClick={() => onChangeSpeechRate('slow')}
              >
                Nghe chậm
              </button>
            </div>
          </div>

          <p className="muted">
            Chạm vào từng thẻ để nghe phát âm mẫu. Khuyến khích bé nói theo tự
            nhiên, không tạo áp lực phải phát âm hoàn hảo.
          </p>

          <div className="word-grid">
            {lesson.words.map((item) => {
              const isPlaying = speakingText === item.word
              return (
                <button
                  type="button"
                  className={`word-card ${isPlaying ? 'is-speaking' : ''}`}
                  key={item.word}
                  onClick={() => speak(item.word)}
                >
                  <span className="word-emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <b lang="en">{item.word}</b>
                  <span className="word-vi">{item.meaningVi}</span>
                  <span className="word-audio-hint">
                    <Volume2 size={15} aria-hidden="true" />
                    <span>{isPlaying ? 'Đang đọc…' : 'Nghe'}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="phrase-box">
            <h3>Mẫu câu giao tiếp trong bài</h3>
            <div className="phrase-list">
              {lesson.phrases.map((phrase) => {
                const isPlaying = speakingText === phrase.en
                return (
                  <button
                    type="button"
                    key={phrase.en}
                    className={`phrase-btn ${isPlaying ? 'is-speaking' : ''}`}
                    onClick={() => speak(phrase.en)}
                  >
                    <Volume2 size={17} aria-hidden="true" />
                    <span className="phrase-texts">
                      <strong lang="en">{phrase.en}</strong>
                      <small>{phrase.vi}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <LessonActivity
            lessonId={lesson.id}
            config={lesson.activityConfig}
            onSpeak={(text) => speak(text)}
            onSpeakSequence={(items) => speakSequence(items)}
          />

          <div className="practice-box">
            <div>
              <p className="step-label">03 / Thử nói cùng bé</p>
              <h3 lang="en">Your turn!</h3>
              <p>
                Nhấn nút micro để thử nói một từ hoặc câu trong bài. Bản chép
                lời chỉ mang tính tham khảo trên trình duyệt, không phải điểm
                đánh giá phát âm.
              </p>
            </div>
            <button
              type="button"
              className={`mic-button ${listening ? 'listening' : ''}`}
              onClick={startMic}
              aria-pressed={listening}
            >
              {micSupported ? (
                <Mic size={22} aria-hidden="true" />
              ) : (
                <MicOff size={22} aria-hidden="true" />
              )}
              <span>{listening ? 'Dừng nghe' : 'Thử nói'}</span>
            </button>
          </div>

          {transcript && (
            <div className="transcript" role="status">
              <strong>Trình duyệt ghi nhận:</strong>{' '}
              <span lang="en">{transcript}</span>
            </div>
          )}

          {speechNotice && (
            <div className="feedback" role="status">
              {speechNotice}
            </div>
          )}

          {completionBanner && (
            <div className="feedback success-banner" role="status">
              {completionBanner}
            </div>
          )}

          <div className="lesson-finish-bar">
            <button
              type="button"
              className="primary complete-btn"
              onClick={handleFinish}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                {isCompleted
                  ? 'Đã hoàn thành bài học'
                  : 'Hoàn thành bài học'}
              </span>
            </button>

            {nextLesson && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  onNavigate({ page: 'lesson', lessonId: nextLesson.lesson.id })
                }
              >
                <span>Bài tiếp theo: {nextLesson.lesson.title}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        <aside className="lesson-side">
          <div className="side-card">
            <span className="side-icon" aria-hidden="true">
              🎯
            </span>
            <h3>Mục tiêu bài học</h3>
            <p>{lesson.objective}</p>
          </div>
          <div className="side-card">
            <span className="side-icon" aria-hidden="true">
              🎮
            </span>
            <h3>Gợi ý hoạt động</h3>
            <p>{lesson.activity}</p>
          </div>
          <div className="side-card parent-note">
            <LockKeyhole size={19} aria-hidden="true" />
            <h3>Dành cho phụ huynh</h3>
            <p>{lesson.parentTip}</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
