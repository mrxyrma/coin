import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

/**
 * Единый источник времени для всей страницы.
 *
 * Lenis, GSAP и three.js каждый по умолчанию заводят свой requestAnimationFrame.
 * Три независимых цикла в одном кадре дают рассинхрон: сцена рисуется по
 * позиции скролла, которая обновится только в следующем кадре, — появляется
 * плавающее отставание монеты от текста. Поэтому Lenis крутится из gsap.ticker,
 * а R3F переводится на ручной рендер из него же (см. CoinCanvas).
 */
export function initScroll() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    autoRaf: false,
    // При reduced-motion инерцию выключаем: остаётся обычный нативный скролл
    lerp: reduced ? 1 : 0.1,
    smoothWheel: !reduced,
  })

  lenis.on('scroll', ScrollTrigger.update)

  const tick = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  // Иначе после долгого лага GSAP «проглатывает» кадр и скролл дёргается
  gsap.ticker.lagSmoothing(0)

  return () => {
    gsap.ticker.remove(tick)
    lenis.destroy()
  }
}

export { gsap, ScrollTrigger }
