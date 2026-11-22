import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gauge,
  LockKeyhole,
  Mic,
  MicOff,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useSpeech } from '../hooks/useSpeech'
import type { Lesson, LessonLocation, Level, Unit } from '../types/curriculum'
import type { ChildProfile } from '../types/platform'
import type { RouteState } from '../utils/router'
import type { SpeechRateMode } from '../utils/storage'
import { AIBuddyPanel } from './AIBuddyPanel'
import { LessonActivity } from './LessonActivity'

interface LessonPageProps {
  level: Level
  unit: Unit
  lesson: Lesson
  prevLesson: LessonLocation | null
  nextLesson: LessonLocation | null
  isCompleted: boolean
  isStarted: boolean
  initialStep: number
  speechRate: SpeechRateMode
  activeChild: ChildProfile | null
  hasAiConsent: boolean
  isAuthenticated: boolean
  onChangeSpeechRate: (mode: SpeechRateMode) => void
  onSaveProgressStep: (
    lessonId: string,
    step: number,
    elapsedSeconds: number
  ) => void
  onRecordAttempt: (
    lessonId: string,
    activityKind: string,
    durationSeconds: number
  ) => void
  onCompleteLesson: (lessonId: string, elapsedSeconds: number) => void
  onNavigate: (route: RouteState) => void
}

function Soundwave() {
  return (
    <span className="soundwave" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

const STEP_LABELS = ['Từ vựng', 'Hoạt động', 'Thử nói', 'AI Buddy']

export function LessonPage({
  level,
  unit,
  lesson,
  prevLesson,
  nextLesson,
  isCompleted,
  isStarted,
  initialStep,
  speechRate,
  activeChild,
  hasAiConsent,
  isAuthenticated,
  onChangeSpeechRate,
  onSaveProgressStep,
  onRecordAttempt,
  onCompleteLesson,
  onNavigate,
}: LessonPageProps) {
  const [completionBanner, setCompletionBanner] = useState('')
  const [currentStep, setCurrentStep] = useState(initialStep)
  const lessonStartMsRef = useRef<number>(Date.now())
  const activitySectionRef = useRef<HTMLDivElement | null>(null)

  const {
    activeAudioId,
    listening,
    transcript,
    speechNotice,
    fallbackNotice,
    micSupported,
    speak,
    speakSequence,
    startMic,
    stopAll,
    resetTranscript,
    dismissFallbackNotice,
  } = useSpeech(speechRate, level.id)

  useEffect(() => {
    stopAll()
    resetTranscript()
    setCompletionBanner('')
    setCurrentStep(initialStep)
    lessonStartMsRef.current = Date.now()
  }, [lesson.id, initialStep, stopAll, resetTranscript])

  const getElapsedSeconds = () =>
    Math.max(1, Math.round((Date.now() - lessonStartMsRef.current) / 1000))

  // Persist midpoint state automatically when leaving/unmounting mid-lesson
  useEffect(() => {
    return () => {
      if (!isCompleted && currentStep > 0) {
        onSaveProgressStep(lesson.id, currentStep, getElapsedSeconds())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, isCompleted, currentStep])

  const advanceStep = (nextStep: number) => {
    const clamped = Math.max(currentStep, nextStep)
    setCurrentStep(clamped)
    onSaveProgressStep(lesson.id, clamped, getElapsedSeconds())
  }

  const handleFinish = () => {
    onCompleteLesson(lesson.id, getElapsedSeconds())
    setCurrentStep(4)
    setCompletionBanner(
      'Tuyệt vời! Bài học đã được đánh dấu hoàn thành. Hãy khen bé vì đã cố gắng nhé!'
    )
  }

  const progressPct = isCompleted
    ? 100
    : Math.min(92, Math.max(20, (currentStep + 1) * 20))

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
          {activeChild ? `${activeChild.avatarEmoji} ${activeChild.nickname} · ` : ''}
          {level.name} · {level.age} · {unit.title}
        </p>
        <h1 lang="en">{lesson.title}</h1>
        <p>{lesson.objective}</p>
        <div className="lesson-meta-line centered tabular-nums">
          <span>{lesson.duration}</span>
          <span aria-hidden="true">·</span>
          <span>{lesson.words.length} từ trọng tâm</span>
          <span aria-hidden="true">·</span>
          <span>
            {isCompleted
              ? 'Đã hoàn thành'
              : isStarted
                ? `Đang học (Bước ${Math.min(4, currentStep + 1)}/4)`
                : 'Chưa bắt đầu'}
          </span>
        </div>

        <div className="lesson-player-controls">
          <button
            type="button"
            className="primary compact"
            onClick={() => {
              const firstWord = lesson.words[0]
              if (firstWord) {
                speak(
                  firstWord.word,
                  speechRate,
                  `word-${speechRate}-${lesson.id}-${firstWord.word}`,
                  firstWord.audioUrl
                )
              }
              advanceStep(Math.max(1, currentStep))
            }}
          >
            <Play size={16} aria-hidden="true" />
            <span>
              {isStarted && !isCompleted
                ? 'Tiếp tục bài học'
                : 'Bắt đầu bài học'}
            </span>
          </button>

          <div className="step-pills" aria-label="Tiến trình các bước trong bài">
            {STEP_LABELS.map((label, idx) => (
              <span
                key={label}
                className={`step-pill ${currentStep >= idx ? 'is-active' : ''}`}
              >
                {idx + 1}. {label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progressPct}%` }} />
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
              aria-label="Tốc độ mặc định cho trò chơi nghe"
            >
              <Gauge size={18} aria-hidden="true" />
              <button
                type="button"
                className={speechRate === 'normal' ? 'active' : ''}
                aria-pressed={speechRate === 'normal'}
                onClick={() => onChangeSpeechRate('normal')}
              >
                Mặc định: Chuẩn
              </button>
              <button
                type="button"
                className={speechRate === 'slow' ? 'active' : ''}
                aria-pressed={speechRate === 'slow'}
                onClick={() => onChangeSpeechRate('slow')}
              >
                <span className="turtle-icon" aria-hidden="true">🐢</span>
                <span>Mặc định: Chậm</span>
              </button>
            </div>
          </div>

          <p className="muted">
            Chạm nút <strong>Nghe</strong> để nghe giọng đọc chuẩn theo độ tuổi,
            hoặc <strong>🐢 Nghe chậm</strong> để bé 3–5 tuổi nghe rõ từng âm tiết.
            Khuyến khích bé nhắc lại tự nhiên, không tạo áp lực phải phát âm
            hoàn hảo.
          </p>

          <div className="word-grid">
            {lesson.words.map((item) => {
              const normalId = `word-normal-${lesson.id}-${item.word}`
              const slowId = `word-slow-${lesson.id}-${item.word}`
              const isNormalPlaying = activeAudioId === normalId
              const isSlowPlaying = activeAudioId === slowId
              const isAnyPlaying = isNormalPlaying || isSlowPlaying

              return (
                <div
                  className={`word-card ${isAnyPlaying ? 'is-speaking' : ''}`}
                  key={item.word}
                >
                  <button
                    type="button"
                    lang="en"
                    aria-label={`Listen to ${item.word}`}
                    className="word-card-face"
                    onClick={() => {
                      speak(item.word, 'normal', normalId, item.audioUrl)
                      advanceStep(1)
                    }}
                  >
                    <span className="word-emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <b lang="en">{item.word}</b>
                    <span className="word-vi" lang="vi">
                      {item.meaningVi}
                    </span>
                  </button>

                  <div className="word-card-controls">
                    <button
                      type="button"
                      lang="en"
                      aria-label={`Listen to ${item.word}`}
                      className={`audio-pill-btn ${
                        isNormalPlaying ? 'is-speaking' : ''
                      }`}
                      onClick={() => {
                        speak(item.word, 'normal', normalId, item.audioUrl)
                        advanceStep(1)
                      }}
                    >
                      <Volume2 size={20} aria-hidden="true" />
                      <span lang="vi">
                        {isNormalPlaying ? 'Đang đọc...' : 'Nghe'}
                      </span>
                      {isNormalPlaying && <Soundwave />}
                    </button>

                    <button
                      type="button"
                      lang="en"
                      aria-label={`Listen slowly to ${item.word}`}
                      className={`audio-pill-btn slow ${
                        isSlowPlaying ? 'is-speaking' : ''
                      }`}
                      onClick={() => {
                        speak(item.word, 'slow', slowId, item.audioUrl)
                        advanceStep(1)
                      }}
                    >
                      <span className="turtle-icon" aria-hidden="true">🐢</span>
                      <span lang="vi">
                        {isSlowPlaying ? 'Đang chậm...' : 'Nghe chậm'}
                      </span>
                      {isSlowPlaying && <Soundwave />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="phrase-box">
            <h3>Mẫu câu giao tiếp trong bài</h3>
            <div className="phrase-list">
              {lesson.phrases.map((phrase, index) => {
                const normalId = `phrase-normal-${lesson.id}-${index}`
                const slowId = `phrase-slow-${lesson.id}-${index}`
                const isNormalPlaying = activeAudioId === normalId
                const isSlowPlaying = activeAudioId === slowId
                const isAnyPlaying = isNormalPlaying || isSlowPlaying

                return (
                  <div
                    key={phrase.en}
                    className={`phrase-row ${isAnyPlaying ? 'is-speaking' : ''}`}
                  >
                    <button
                      type="button"
                      lang="en"
                      aria-label={`Listen to ${phrase.en}`}
                      className="phrase-text-btn"
                      onClick={() => {
                        speak(phrase.en, 'normal', normalId, phrase.audioUrl)
                        advanceStep(1)
                      }}
                    >
                      <strong lang="en">{phrase.en}</strong>
                      <small lang="vi">{phrase.vi}</small>
                    </button>

                    <div className="phrase-controls">
                      <button
                        type="button"
                        lang="en"
                        aria-label={`Listen to ${phrase.en}`}
                        className={`audio-pill-btn ${
                          isNormalPlaying ? 'is-speaking' : ''
                        }`}
                        onClick={() => {
                          speak(phrase.en, 'normal', normalId, phrase.audioUrl)
                          advanceStep(1)
                        }}
                      >
                        <Volume2 size={20} aria-hidden="true" />
                        <span lang="vi">
                          {isNormalPlaying ? 'Đang đọc...' : 'Nghe'}
                        </span>
                        {isNormalPlaying && <Soundwave />}
                      </button>

                      <button
                        type="button"
                        lang="en"
                        aria-label={`Listen slowly to ${phrase.en}`}
                        className={`audio-pill-btn slow ${
                          isSlowPlaying ? 'is-speaking' : ''
                        }`}
                        onClick={() => {
                          speak(phrase.en, 'slow', slowId, phrase.audioUrl)
                          advanceStep(1)
                        }}
                      >
                        <span className="turtle-icon" aria-hidden="true">🐢</span>
                        <span lang="vi">
                          {isSlowPlaying ? 'Đang nghe chậm...' : 'Nghe chậm'}
                        </span>
                        {isSlowPlaying && <Soundwave />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div ref={activitySectionRef}>
            <LessonActivity
              lessonId={lesson.id}
              config={lesson.activityConfig}
              activeAudioId={activeAudioId}
              onSpeak={speak}
              onSpeakSequence={speakSequence}
              onActivityCompleted={() => {
                advanceStep(2)
                onRecordAttempt(
                  lesson.id,
                  lesson.activityConfig.kind,
                  getElapsedSeconds()
                )
              }}
            />
          </div>

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
              onClick={() => {
                startMic()
                advanceStep(3)
              }}
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

          <AIBuddyPanel
            level={level}
            lesson={lesson}
            activeChild={activeChild}
            hasAiConsent={hasAiConsent}
            isAuthenticated={isAuthenticated}
            onNavigate={onNavigate}
          />

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

      {fallbackNotice && (
        <div className="speech-error-toast" role="alert">
          <VolumeX size={18} aria-hidden="true" />
          <span>{fallbackNotice}</span>
          <button
            type="button"
            className="fallback-dismiss-btn"
            aria-label="Đóng thông báo âm thanh"
            onClick={dismissFallbackNotice}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </main>
  )
}
