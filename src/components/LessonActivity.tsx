import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, Sparkles, Volume2 } from 'lucide-react'
import type { ActivityConfig, StoryStep } from '../types/curriculum'
import type { SpeechSpeed } from '../utils/speech'

interface LessonActivityProps {
  lessonId: string
  config: ActivityConfig
  activeAudioId: string | null
  onSpeak: (text: string, overrideRate?: SpeechSpeed, activeId?: string) => void
  onSpeakSequence: (
    items: string[],
    overrideRate?: SpeechSpeed,
    activeId?: string
  ) => void
  onActivityCompleted?: () => void
}

function deterministicShuffle(steps: StoryStep[]): StoryStep[] {
  if (steps.length <= 1) return steps
  const copy = [...steps]
  const rotated = [...copy.slice(1), copy[0]]
  if (rotated.length >= 3) {
    const temp = rotated[0]
    rotated[0] = rotated[1]
    rotated[1] = temp
  }
  return rotated
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

export function LessonActivity({
  lessonId,
  config,
  activeAudioId,
  onSpeak,
  onSpeakSequence,
  onActivityCompleted,
}: LessonActivityProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null)
  const [roundResult, setRoundResult] = useState<'idle' | 'correct' | 'retry'>(
    'idle'
  )
  const [activityDone, setActivityDone] = useState(false)

  const [selectedChipIndices, setSelectedChipIndices] = useState<number[]>([])
  const [sentenceFeedback, setSentenceFeedback] = useState<string>('')

  const [orderedStepIds, setOrderedStepIds] = useState<string[]>([])
  const [storyError, setStoryError] = useState<string>('')

  useEffect(() => {
    setRoundIndex(0)
    setPickedOptionId(null)
    setRoundResult('idle')
    setActivityDone(false)
    setSelectedChipIndices([])
    setSentenceFeedback('')
    setOrderedStepIds([])
    setStoryError('')
  }, [lessonId])

  const shuffledStorySteps = useMemo(() => {
    if (config.kind !== 'story_order') return []
    return deterministicShuffle(config.steps)
  }, [config])

  if (config.kind === 'listen_pick' || config.kind === 'match_pick') {
    const rounds = config.rounds
    const currentRound = rounds[roundIndex] ?? rounds[0]
    const isListen = config.kind === 'listen_pick'
    const listenNormalId = `activity-listen-normal-${lessonId}-${roundIndex}`
    const listenSlowId = `activity-listen-slow-${lessonId}-${roundIndex}`

    const handlePick = (optionId: string, label: string) => {
      setPickedOptionId(optionId)
      onSpeak(label, undefined, `activity-opt-${lessonId}-${optionId}`)

      if (optionId === currentRound.correctId) {
        setRoundResult('correct')
        if (roundIndex === rounds.length - 1) {
          setActivityDone(true)
          onActivityCompleted?.()
        }
      } else {
        setRoundResult('retry')
      }
    }

    const handleNextRound = () => {
      if (roundIndex < rounds.length - 1) {
        setRoundIndex((i) => i + 1)
        setPickedOptionId(null)
        setRoundResult('idle')
      } else {
        setRoundIndex(0)
        setPickedOptionId(null)
        setRoundResult('idle')
        setActivityDone(false)
      }
    }

    return (
      <div className="activity-stage">
        <div className="activity-header">
          <div>
            <p className="step-label">02 / Hoạt động tương tác</p>
            <h3>{config.promptVi}</h3>
          </div>
          <span className="activity-counter tabular-nums">
            Lượt {roundIndex + 1}/{rounds.length}
          </span>
        </div>

        {isListen && config.rounds[roundIndex] && (
          <div className="activity-prompt-card">
            <div className="activity-audio-pair">
              <button
                type="button"
                lang="en"
                aria-label={`Listen: ${config.rounds[roundIndex].audioText}`}
                className={`listen-hero-btn ${
                  activeAudioId === listenNormalId ? 'is-speaking' : ''
                }`}
                onClick={() =>
                  onSpeak(
                    config.rounds[roundIndex].audioText,
                    'normal',
                    listenNormalId
                  )
                }
              >
                <Volume2 size={20} aria-hidden="true" />
                <span lang="vi">
                  {activeAudioId === listenNormalId
                    ? 'Đang đọc...'
                    : 'Nghe câu mẫu'}
                </span>
                {activeAudioId === listenNormalId && <Soundwave />}
              </button>

              <button
                type="button"
                lang="en"
                aria-label={`Listen slowly: ${config.rounds[roundIndex].audioText}`}
                className={`audio-pill-btn slow ${
                  activeAudioId === listenSlowId ? 'is-speaking' : ''
                }`}
                onClick={() =>
                  onSpeak(
                    config.rounds[roundIndex].audioText,
                    'slow',
                    listenSlowId
                  )
                }
              >
                <span aria-hidden="true">🐢</span>
                <span lang="vi">
                  {activeAudioId === listenSlowId
                    ? 'Đang nghe chậm...'
                    : 'Nghe chậm'}
                </span>
                {activeAudioId === listenSlowId && <Soundwave />}
              </button>
            </div>
            <p className="activity-hint">{config.rounds[roundIndex].hintVi}</p>
          </div>
        )}

        {!isListen && config.rounds[roundIndex] && (
          <div className="activity-prompt-card clue-card">
            <span className="clue-emoji" aria-hidden="true">
              {config.rounds[roundIndex].clueEmoji}
            </span>
            <p className="clue-text">{config.rounds[roundIndex].clueVi}</p>
          </div>
        )}

        <div className="activity-options-grid">
          {currentRound.options.map((option) => {
            const isPicked = pickedOptionId === option.id
            const isCorrect =
              roundResult === 'correct' && option.id === currentRound.correctId
            const isWrong = roundResult === 'retry' && isPicked
            const optAudioId = `activity-opt-${lessonId}-${option.id}`
            const isPlaying = activeAudioId === optAudioId

            return (
              <button
                type="button"
                lang="en"
                key={option.id}
                className={`activity-option-card ${
                  isCorrect ? 'is-correct' : ''
                } ${isWrong ? 'is-retry' : ''} ${
                  isPlaying ? 'is-speaking' : ''
                }`}
                onClick={() => handlePick(option.id, option.label)}
              >
                <span className="option-emoji" aria-hidden="true">
                  {option.emoji}
                </span>
                <b lang="en">{option.label}</b>
                {option.sublabel && <small lang="vi">{option.sublabel}</small>}
              </button>
            )
          })}
        </div>

        {roundResult === 'correct' && (
          <div className="activity-feedback success" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              {activityDone
                ? 'Tuyệt vời! Bé đã hoàn thành tất cả các lượt chơi!'
                : 'Đúng rồi! Bé giỏi lắm, cùng sang lượt tiếp theo nhé.'}
            </span>
            <button
              type="button"
              className="activity-next-btn"
              onClick={handleNextRound}
            >
              {roundIndex < rounds.length - 1 ? 'Lượt tiếp theo' : 'Chơi lại'}
            </button>
          </div>
        )}

        {roundResult === 'retry' && (
          <div className="activity-feedback retry" role="status">
            <span>
              Chưa đúng lắm, bé thử nghe lại và chọn đáp án khác nhé!
            </span>
          </div>
        )}
      </div>
    )
  }

  if (config.kind === 'sentence_build') {
    const builtWords = selectedChipIndices.map((idx) => config.chips[idx])
    const builtSentence = builtWords.join(' ')
    const normalizedBuilt = builtSentence
      .replace(/[.,!?]/g, '')
      .trim()
      .toLowerCase()

    const isMatched = config.targetSentences.some(
      (target) =>
        target.replace(/[.,!?]/g, '').trim().toLowerCase() === normalizedBuilt
    )

    const starterNormalId = `starter-normal-${lessonId}`
    const starterSlowId = `starter-slow-${lessonId}`

    const toggleChip = (idx: number) => {
      setSentenceFeedback('')
      setSelectedChipIndices((prev) =>
        prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
      )
      onSpeak(config.chips[idx], undefined, `chip-${lessonId}-${idx}`)
    }

    const checkSentence = () => {
      if (!builtSentence) {
        setSentenceFeedback('Bé hãy chạm vào các thẻ từ để ghép câu trước nhé.')
        return
      }
      if (isMatched) {
        setSentenceFeedback('Chính xác! Bé vừa ghép được câu tiếng Anh hoàn chỉnh.')
        onSpeak(builtSentence, undefined, `built-${lessonId}`)
        setActivityDone(true)
        onActivityCompleted?.()
      } else {
        setSentenceFeedback(
          'Câu gần đúng rồi! Bé thử nghe mẫu hoặc đổi lại thứ tự các thẻ từ nhé.'
        )
      }
    }

    return (
      <div className="activity-stage">
        <div className="activity-header">
          <div>
            <p className="step-label">02 / Hoạt động ghép câu</p>
            <h3>{config.promptVi}</h3>
          </div>
        </div>

        <div className="activity-prompt-card starter-card">
          <div className="activity-audio-pair">
            <button
              type="button"
              lang="en"
              className={`starter-listen-btn ${
                activeAudioId === starterNormalId ? 'is-speaking' : ''
              }`}
              onClick={() =>
                onSpeak(config.starterPromptEn, 'normal', starterNormalId)
              }
            >
              <Volume2 size={18} aria-hidden="true" />
              <span lang="en">{config.starterPromptEn}</span>
              {activeAudioId === starterNormalId && <Soundwave />}
            </button>
            <button
              type="button"
              lang="en"
              aria-label={`Listen slowly: ${config.starterPromptEn}`}
              className={`audio-pill-btn slow ${
                activeAudioId === starterSlowId ? 'is-speaking' : ''
              }`}
              onClick={() =>
                onSpeak(config.starterPromptEn, 'slow', starterSlowId)
              }
            >
              <span aria-hidden="true">🐢</span>
              <span lang="vi">
                {activeAudioId === starterSlowId
                  ? 'Đang nghe chậm...'
                  : 'Nghe chậm'}
              </span>
              {activeAudioId === starterSlowId && <Soundwave />}
            </button>
          </div>
          <p className="activity-hint">{config.starterPromptVi}</p>
        </div>

        <div className="sentence-tray" aria-live="polite">
          {builtWords.length === 0 ? (
            <span className="tray-placeholder">
              Chạm vào các thẻ từ bên dưới để ghép câu tại đây…
            </span>
          ) : (
            <div className="tray-words">
              {selectedChipIndices.map((chipIndex) => (
                <button
                  type="button"
                  key={`selected-${chipIndex}`}
                  className="word-chip in-tray"
                  lang="en"
                  onClick={() => toggleChip(chipIndex)}
                >
                  {config.chips[chipIndex]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chips-bank">
          {config.chips.map((chip, idx) => {
            const used = selectedChipIndices.includes(idx)
            return (
              <button
                type="button"
                key={`bank-${chip}-${idx}`}
                className={`word-chip ${used ? 'is-used' : ''}`}
                disabled={used}
                lang="en"
                onClick={() => toggleChip(idx)}
              >
                {chip}
              </button>
            )
          })}
        </div>

        <div className="sentence-actions">
          <button
            type="button"
            className="primary compact"
            onClick={checkSentence}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>Kiểm tra &amp; Nghe câu</span>
          </button>
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              setSelectedChipIndices([])
              setSentenceFeedback('')
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Xếp lại</span>
          </button>
        </div>

        <p className="activity-tip-note">{config.tipsVi}</p>

        {sentenceFeedback && (
          <div
            className={`activity-feedback ${
              activityDone && isMatched ? 'success' : 'retry'
            }`}
            role="status"
          >
            <span>{sentenceFeedback}</span>
          </div>
        )}
      </div>
    )
  }

  // story_order
  const expectedNextOrder = orderedStepIds.length + 1
  const allOrdered = orderedStepIds.length === config.steps.length
  const storyNormalId = `story-seq-normal-${lessonId}`
  const storySlowId = `story-seq-slow-${lessonId}`

  const handlePickStoryStep = (step: StoryStep) => {
    if (orderedStepIds.includes(step.id)) return

    if (step.order === expectedNextOrder) {
      const nextList = [...orderedStepIds, step.id]
      setOrderedStepIds(nextList)
      setStoryError('')
      onSpeak(step.en, undefined, `story-step-${step.id}`)
      if (nextList.length === config.steps.length) {
        setActivityDone(true)
        onActivityCompleted?.()
      }
    } else {
      setStoryError(
        `Gợi ý: Tìm bước diễn ra tiếp theo (Bước số ${expectedNextOrder}) nhé!`
      )
    }
  }

  return (
    <div className="activity-stage">
      <div className="activity-header">
        <div>
          <p className="step-label">02 / Hoạt động kể chuyện theo trình tự</p>
          <h3>{config.promptVi}</h3>
        </div>
        <span className="activity-counter tabular-nums">
          {orderedStepIds.length}/{config.steps.length} bước
        </span>
      </div>

      {orderedStepIds.length > 0 && (
        <div className="story-timeline">
          {orderedStepIds.map((id, idx) => {
            const step = config.steps.find((s) => s.id === id)
            if (!step) return null
            const stepAudioId = `story-step-${step.id}`
            const isPlaying = activeAudioId === stepAudioId
            return (
              <button
                type="button"
                lang="en"
                key={id}
                className={`story-timeline-item ${isPlaying ? 'is-speaking' : ''}`}
                onClick={() => onSpeak(step.en, undefined, stepAudioId)}
              >
                <span className="story-badge tabular-nums">{idx + 1}</span>
                <span className="story-emoji" aria-hidden="true">
                  {step.emoji}
                </span>
                <div className="story-item-text">
                  <b lang="en">{step.en}</b>
                  <small lang="vi">{step.vi}</small>
                </div>
                {isPlaying ? <Soundwave /> : <Volume2 size={16} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}

      {!allOrdered && (
        <div className="story-pool">
          {shuffledStorySteps.map((step) => {
            const picked = orderedStepIds.includes(step.id)
            return (
              <button
                type="button"
                lang="en"
                key={step.id}
                className={`story-pool-card ${picked ? 'is-picked' : ''}`}
                disabled={picked}
                onClick={() => handlePickStoryStep(step)}
              >
                <span className="story-emoji" aria-hidden="true">
                  {step.emoji}
                </span>
                <div className="story-item-text">
                  <b lang="en">{step.en}</b>
                  <small lang="vi">{step.vi}</small>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {storyError && (
        <div className="activity-feedback retry" role="status">
          <span>{storyError}</span>
        </div>
      )}

      {allOrdered && (
        <div className="activity-feedback success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Tuyệt vời! Câu chuyện đã đúng trình tự rồi!</span>
          <div className="story-finish-actions">
            <button
              type="button"
              lang="en"
              aria-label="Listen to the whole story"
              className={`activity-next-btn ${
                activeAudioId === storyNormalId ? 'is-speaking' : ''
              }`}
              onClick={() =>
                onSpeakSequence(
                  config.steps.map((s) => s.en),
                  'normal',
                  storyNormalId
                )
              }
            >
              <Volume2 size={15} aria-hidden="true" />
              <span lang="vi">
                {activeAudioId === storyNormalId
                  ? 'Đang đọc...'
                  : 'Nghe cả câu chuyện'}
              </span>
              {activeAudioId === storyNormalId && <Soundwave />}
            </button>
            <button
              type="button"
              lang="en"
              aria-label="Listen slowly to the whole story"
              className={`audio-pill-btn slow ${
                activeAudioId === storySlowId ? 'is-speaking' : ''
              }`}
              onClick={() =>
                onSpeakSequence(
                  config.steps.map((s) => s.en),
                  'slow',
                  storySlowId
                )
              }
            >
              <span aria-hidden="true">🐢</span>
              <span lang="vi">
                {activeAudioId === storySlowId
                  ? 'Đang nghe chậm...'
                  : 'Nghe chậm'}
              </span>
              {activeAudioId === storySlowId && <Soundwave />}
            </button>
            <button
              type="button"
              className="outline-btn"
              onClick={() => {
                setOrderedStepIds([])
                setStoryError('')
                setActivityDone(false)
              }}
            >
              Xếp lại
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
