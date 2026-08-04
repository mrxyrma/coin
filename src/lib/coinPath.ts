import {
  DWELL,
  MOBILE_BREAKPOINT,
  MOBILE_BULGE_FACTOR,
  TRAJECTORY,
} from './trajectory'

/** Состояние монеты в координатах вьюпорта, CSS-пиксели. */
export type CoinState = {
  x: number
  y: number
  /** Диаметр на экране, px */
  size: number
  rotX: number
  rotY: number
}

export type Measured = {
  id: string
  /** Центр якоря в системе координат документа */
  cx: number
  cyDoc: number
  size: number
  rotX: number
  /** Накопленный угол поворота к этой точке */
  rotY: number
  bulgeOut: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

function measureAnchor(id: string, scrollY: number) {
  const el = document.querySelector<HTMLElement>(`[data-coin-anchor="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    cx: r.left + r.width / 2,
    cyDoc: r.top + scrollY + r.height / 2,
    // Ширина, а не высота: у якоря в ложементе соотношение 206×144
    size: r.width,
  }
}

/**
 * Путь монеты по странице.
 *
 * Меряет DOM-якоря, строит по ним кусочно-квадратичную кривую и отдаёт
 * состояние монеты для произвольной позиции скролла. Позиции берутся из
 * вёрстки, поэтому траектория подстраивается под любую ширину экрана.
 */
export class CoinPath {
  private points: Measured[] = []
  private statics = new Map<string, { cx: number; cyDoc: number; size: number }>()
  private vw = 0

  /**
   * Счётчик обмеров. Кадровый цикл включает его в сигнатуру кадра, чтобы
   * перерисоваться после resize, даже если скролл не двигался.
   */
  version = 0

  /**
   * Режим бережной анимации: монета не летит, а стоит в позиции ближайшей
   * секции. Включается prefers-reduced-motion.
   */
  reduced = false

  /** Пересчитать геометрию. Вызывать на resize и ScrollTrigger.refresh. */
  measure() {
    const scrollY = window.scrollY
    this.vw = window.innerWidth
    this.points = []
    this.version++

    let rotY = 0
    for (const wp of TRAJECTORY) {
      const m = measureAnchor(wp.id, scrollY)
      if (!m) continue
      rotY += wp.halfTurnsIn * Math.PI
      this.points.push({
        id: wp.id,
        ...m,
        rotX: wp.rotX,
        rotY,
        bulgeOut: wp.bulgeOut,
      })
    }

    this.statics.clear()
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-coin-anchor]',
    )) {
      const id = el.dataset.coinAnchor
      if (!id || this.points.some((p) => p.id === id)) continue
      const m = measureAnchor(id, scrollY)
      if (m) this.statics.set(id, m)
    }
  }

  get ready() {
    return this.points.length >= 2
  }

  /** Позиция статичного якоря (например, серебряной монеты на первом экране). */
  sampleStatic(id: string, scrollY: number): CoinState | null {
    const m = this.statics.get(id)
    if (!m) return null
    return { x: m.cx, y: m.cyDoc - scrollY, size: m.size, rotX: 0, rotY: 0 }
  }

  sample(scrollY: number, vh: number): CoinState {
    return samplePath(this.points, scrollY, vh, this.vw, this.reduced)
  }
}

/**
 * Чистая функция выборки — вся математика траектории.
 *
 * Вынесена из класса, чтобы её можно было проверять без DOM
 * (см. src/lib/coinPath.test.ts).
 */
export function samplePath(
  pts: Measured[],
  scrollY: number,
  vh: number,
  vw: number,
  reduced = false,
): CoinState {
  const half = vh / 2
  /** Скролл, при котором точка i оказывается в центре экрана */
  const dock = (i: number) => pts[i].cyDoc - half

  const at = (i: number): CoinState => ({
    x: pts[i].cx,
    y: pts[i].cyDoc - scrollY,
    size: pts[i].size,
    rotX: pts[i].rotX,
    rotY: pts[i].rotY,
  })

  if (pts.length === 0) return { x: 0, y: 0, size: 0, rotX: 0, rotY: 0 }
  if (pts.length === 1 || scrollY <= dock(0)) return at(0)
  if (scrollY >= dock(pts.length - 1)) return at(pts.length - 1)

  let i = 0
  while (i < pts.length - 2 && scrollY >= dock(i + 1)) i++

  // Бережный режим: монета просто стоит в позиции ближайшей секции,
  // никакого полёта и вращения по скроллу
  if (reduced) {
    const nearer =
      Math.abs(scrollY - dock(i)) <= Math.abs(scrollY - dock(i + 1))
        ? i
        : i + 1
    return at(nearer)
  }

  const a = pts[i]
  const b = pts[i + 1]
  const span = dock(i + 1) - dock(i)
  const u = span > 0 ? (scrollY - dock(i)) / span : 0

  // Залипание на якоре в начале и конце сегмента: монета стоит в макетной
  // позиции, пока секция читается, и летит только на переходе.
  const t = easeInOutCubic(clamp01((u - DWELL) / (1 - 2 * DWELL)))

  // Квадратичная кривая Безье. Контрольная точка вынесена вбок так, чтобы
  // вершина дуги отстояла от прямой ровно на bulgeOut ширин вьюпорта.
  const mobile = vw < MOBILE_BREAKPOINT
  const apex = a.bulgeOut * vw * (mobile ? MOBILE_BULGE_FACTOR : 1)
  const cxCtl = (a.cx + b.cx) / 2 + 2 * apex
  const cyCtl = (a.cyDoc + b.cyDoc) / 2

  const inv = 1 - t
  const w0 = inv * inv
  const w1 = 2 * inv * t
  const w2 = t * t

  return {
    x: w0 * a.cx + w1 * cxCtl + w2 * b.cx,
    y: w0 * a.cyDoc + w1 * cyCtl + w2 * b.cyDoc - scrollY,
    size: lerp(a.size, b.size, t),
    rotX: lerp(a.rotX, b.rotX, t),
    rotY: lerp(a.rotY, b.rotY, t),
  }
}
