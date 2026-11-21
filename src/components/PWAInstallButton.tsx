import { useState } from 'react'
import { Download, Share, Smartphone, X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

interface PWAInstallButtonProps {
  variant?: 'inline' | 'card'
}

export function PWAInstallButton({
  variant = 'inline',
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showGuide, setShowGuide] = useState(false)

  if (isInstalled) {
    return null
  }

  if (variant === 'card') {
    return (
      <div className="side-card pwa-install-card">
        <div className="pwa-card-head">
          <img
            src="/logo-evui.png"
            alt="Biểu tượng English Little World"
            className="pwa-card-icon"
            width={52}
            height={52}
          />
          <div>
            <h3>Cài lên màn hình chính</h3>
            <p className="pwa-card-sub">
              Mở học nhanh như ứng dụng trên iPhone & Android
            </p>
          </div>
        </div>

        {isInstallable ? (
          <button type="button" className="primary compact" onClick={install}>
            <Download size={18} aria-hidden="true" />
            <span>Cài đặt ứng dụng</span>
          </button>
        ) : (
          <button
            type="button"
            className="outline-btn"
            onClick={() => setShowGuide((v) => !v)}
          >
            <Smartphone size={18} aria-hidden="true" />
            <span>{isIOS ? 'Hướng dẫn thêm trên iPhone' : 'Hướng dẫn cài nhanh'}</span>
          </button>
        )}

        {showGuide && (
          <div className="pwa-guide-box">
            {isIOS ? (
              <ol>
                <li>
                  Mở trang bằng <strong>Safari</strong> trên iPhone / iPad.
                </li>
                <li>
                  Chạm nút <strong>Chia sẻ</strong> <Share size={14} aria-hidden="true" /> ở
                  thanh dưới.
                </li>
                <li>
                  Chọn <strong>Thêm vào Màn hình chính</strong> (Add to Home Screen).
                </li>
              </ol>
            ) : (
              <ol>
                <li>
                  <strong>Android (Chrome):</strong> Chạm menu <strong>⋮</strong>{' '}
                  rồi chọn <strong>Thêm vào màn hình chính</strong> /{' '}
                  <strong>Cài đặt ứng dụng</strong>.
                </li>
                <li>
                  <strong>iPhone / iPad (Safari):</strong> Chạm <strong>Chia sẻ</strong>{' '}
                  rồi chọn <strong>Thêm vào Màn hình chính</strong>.
                </li>
              </ol>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!isInstallable && !isIOS) {
    return null
  }

  return (
    <>
      {isInstallable ? (
        <button type="button" className="outline-btn pwa-inline-btn" onClick={install}>
          <Download size={17} aria-hidden="true" />
          <span>Thêm vào màn hình chính</span>
        </button>
      ) : (
        <button
          type="button"
          className="outline-btn pwa-inline-btn"
          onClick={() => setShowGuide(true)}
        >
          <Share size={17} aria-hidden="true" />
          <span>Lưu lên màn hình iPhone</span>
        </button>
      )}

      {showGuide && (
        <div
          className="pwa-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-guide-title"
        >
          <div className="pwa-modal">
            <div className="pwa-modal-head">
              <div className="pwa-card-head">
                <img
                  src="/logo-evui.png"
                  alt="Biểu tượng English Little World"
                  className="pwa-card-icon"
                  width={48}
                  height={48}
                />
                <h3 id="pwa-ios-guide-title">Thêm English Little World vào iPhone</h3>
              </div>
              <button
                type="button"
                className="pwa-modal-close"
                aria-label="Đóng hướng dẫn"
                onClick={() => setShowGuide(false)}
              >
                <X size={20} />
              </button>
            </div>
            <ol className="pwa-modal-steps">
              <li>
                Chạm biểu tượng <strong>Chia sẻ</strong> ở thanh công cụ Safari.
              </li>
              <li>
                Cuộn xuống và chọn <strong>Thêm vào Màn hình chính</strong> (Add to
                Home Screen).
              </li>
              <li>
                Chạm <strong>Thêm</strong> để hiển thị biểu tượng EVUI Kids trên
                màn hình chính.
              </li>
            </ol>
            <button
              type="button"
              className="primary compact"
              onClick={() => setShowGuide(false)}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  )
}
