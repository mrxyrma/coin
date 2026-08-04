import { useEffect, useRef } from 'react'
import { gsap } from '../lib/scroll'
import { coinPath } from '../lib/useCoinEngine'

/**
 * Отладочный маркер: DOM-кружок, летящий по той же кривой, что и будущая
 * 3D-монета. Позволяет настроить траекторию и тайминги до подключения WebGL.
 *
 * Включается флагом ?coin=debug в адресной строке.
 */
export function CoinDebug() {
  const ref = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tick = () => {
      const el = ref.current
      if (!el || !coinPath.ready) return

      const s = coinPath.sample(window.scrollY, window.innerHeight)
      el.style.width = `${s.size}px`
      el.style.height = `${s.size}px`
      el.style.transform = `translate3d(${s.x - s.size / 2}px, ${
        s.y - s.size / 2
      }px, 0) rotateX(${s.rotX}rad) rotateY(${s.rotY}rad)`

      if (label.current) {
        label.current.textContent = `${Math.round(s.x)}, ${Math.round(
          s.y,
        )} · Ø${Math.round(s.size)} · ${Math.round((s.rotY * 180) / Math.PI)}°`
      }
    }

    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Тот же слой, что и у canvas: отладка должна показывать реальное
        // перекрытие текстом и футлярами, а не висеть поверх всего
        zIndex: 1,
        pointerEvents: 'none',
        perspective: '1000px',
      }}
    >
      <div
        ref={ref}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          borderRadius: '50%',
          // Две «стороны»: градиент показывает, каким боком повёрнута монета
          background:
            'linear-gradient(135deg, #d4af37 0%, #f6e27a 50%, #b8860b 100%)',
          border: '2px solid rgba(0,0,0,.4)',
          backfaceVisibility: 'visible',
          willChange: 'transform',
        }}
      />
      <div
        ref={label}
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          zIndex: 100,
          padding: '4px 8px',
          borderRadius: 4,
          background: 'rgba(0,0,0,.75)',
          color: '#fff',
          font: '12px/1.2 ui-monospace, monospace',
          letterSpacing: 0,
        }}
      />
    </div>
  )
}
