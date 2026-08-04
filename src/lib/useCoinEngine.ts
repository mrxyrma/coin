import { useEffect } from 'react'
import { CoinPath } from './coinPath'
import { ScrollTrigger, initScroll } from './scroll'
import { hasWebGL, prefersReducedMotion } from './capabilities'

/**
 * Единственный экземпляр пути на страницу. Синглтон осознанный: монета одна,
 * а прокидывать её состояние пропсами через DOM-секции в canvas-сцену
 * пришлось бы через контекст, который на каждом кадре вызывал бы ре-рендер.
 * Потребители (3D-сцена, отладочный маркер) читают его в своём кадре.
 */
export const coinPath = new CoinPath()

/**
 * Инициализация скролла и обмеров. Вызывается один раз, в корне приложения.
 * Возвращает, показывать ли 3D-сцену.
 */
export function useCoinEngine() {
  const webgl = hasWebGL()

  useEffect(() => {
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    coinPath.reduced = prefersReducedMotion()

    // Без WebGL монету рисует CSS: серые круги на местах якорей, как в макете
    if (!webgl) document.body.dataset.coinPlaceholder = ''

    const onReducedChange = () => {
      coinPath.reduced = reducedQuery.matches
      coinPath.measure()
    }
    reducedQuery.addEventListener('change', onReducedChange)

    const stopScroll = initScroll()

    const measure = () => coinPath.measure()

    measure()
    ScrollTrigger.addEventListener('refresh', measure)

    /*
     * Реагируем только на изменение ШИРИНЫ. Высота документа меняется от
     * любой перекомпоновки, а на мобильных ещё и от появления адресной
     * строки — обмер по высоте давал бы дрожание и мог зациклить
     * ResizeObserver через ScrollTrigger.refresh().
     */
    let lastWidth = window.innerWidth
    const ro = new ResizeObserver(() => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      ScrollTrigger.refresh()
    })
    ro.observe(document.documentElement)

    // Веб-шрифты меняют высоту текста и, значит, позиции якорей
    document.fonts?.ready.then(() => ScrollTrigger.refresh())

    return () => {
      reducedQuery.removeEventListener('change', onReducedChange)
      ScrollTrigger.removeEventListener('refresh', measure)
      ro.disconnect()
      stopScroll()
    }
  }, [webgl])

  return { webgl }
}
