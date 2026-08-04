import { describe, expect, it } from 'vitest'
import { samplePath, type Measured } from './coinPath'
import { DWELL } from './trajectory'

const VW = 1440
const VH = 900

/** Три точки по мотивам макета: hero → смысл → «как выглядит» */
const points: Measured[] = [
  { id: 'a', cx: 638, cyDoc: 285, size: 272, rotX: 0, rotY: 0, bulgeOut: 0.49 },
  {
    id: 'b',
    cx: 720,
    cyDoc: 1642,
    size: 360,
    rotX: -0.1,
    rotY: Math.PI,
    bulgeOut: -0.12,
  },
  {
    id: 'c',
    cx: 412,
    cyDoc: 2482,
    size: 360,
    rotX: 0,
    rotY: 2 * Math.PI,
    bulgeOut: 0,
  },
]

/** Скролл, при котором точка i стоит в центре экрана */
const dock = (i: number) => points[i].cyDoc - VH / 2

describe('samplePath', () => {
  it('в точке стыковки монета стоит ровно на якоре', () => {
    for (let i = 0; i < points.length; i++) {
      const s = samplePath(points, dock(i), VH, VW)
      expect(s.x).toBeCloseTo(points[i].cx, 6)
      expect(s.y).toBeCloseTo(points[i].cyDoc - dock(i), 6)
      expect(s.size).toBeCloseTo(points[i].size, 6)
      expect(s.rotY).toBeCloseTo(points[i].rotY, 6)
    }
  })

  it('до первой и после последней точки монета приклеена к якорю', () => {
    const before = samplePath(points, dock(0) - 500, VH, VW)
    expect(before.x).toBe(points[0].cx)
    expect(before.y).toBe(points[0].cyDoc - (dock(0) - 500))

    const after = samplePath(points, dock(2) + 800, VH, VW)
    expect(after.x).toBe(points[2].cx)
    expect(after.size).toBe(points[2].size)
  })

  it('на залипании монета скроллится вместе со страницей', () => {
    const span = dock(1) - dock(0)
    // Внутри зоны залипания позиция в документе не меняется,
    // значит на экране монета уезжает ровно на дельту скролла
    const s1 = samplePath(points, dock(0) + span * DWELL * 0.2, VH, VW)
    const s2 = samplePath(points, dock(0) + span * DWELL * 0.6, VH, VW)
    const delta = span * DWELL * 0.4
    expect(s1.x).toBeCloseTo(s2.x, 6)
    expect(s1.y - s2.y).toBeCloseTo(delta, 6)
  })

  it('дуга уходит вправо на величину bulgeOut', () => {
    // Вершина дуги приходится на середину активной части сегмента
    const span = dock(1) - dock(0)
    const mid = dock(0) + span * 0.5
    const s = samplePath(points, mid, VH, VW)
    const straightMid = (points[0].cx + points[1].cx) / 2
    const apex = points[0].bulgeOut * VW
    expect(s.x - straightMid).toBeCloseTo(apex, 6)
    expect(s.x).toBeGreaterThan(points[0].cx)
    expect(s.x).toBeLessThan(VW) // не улетает за правый край
  })

  it('на мобиле дуга поджимается', () => {
    const span = dock(1) - dock(0)
    const mid = dock(0) + span * 0.5
    const desktop = samplePath(points, mid, VH, VW)
    const mobile = samplePath(points, mid, VH, 375)
    const straightMid = (points[0].cx + points[1].cx) / 2
    expect(Math.abs(mobile.x - straightMid)).toBeLessThan(
      Math.abs(desktop.x - straightMid),
    )
  })

  it('поворот монотонен по скроллу — при обратной прокрутке нет накопления', () => {
    let prev = -Infinity
    for (let y = dock(0); y <= dock(2); y += 25) {
      const { rotY } = samplePath(points, y, VH, VW)
      expect(rotY).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = rotY
    }
    // Возврат в исходную точку даёт исходный угол
    expect(samplePath(points, dock(0), VH, VW).rotY).toBeCloseTo(0, 9)
  })

  it('к секции «смысл» монета поворачивается другой стороной', () => {
    const s = samplePath(points, dock(1), VH, VW)
    expect(Math.cos(s.rotY)).toBeCloseTo(-1, 6)
  })

  it('бережный режим держит монету на ближайшем якоре без полёта', () => {
    const span = dock(1) - dock(0)
    const mid = dock(0) + span * 0.5

    // Ровно посередине между секциями — снапится к одной из них, не к дуге
    const s = samplePath(points, mid, VH, VW, true)
    expect([points[0].cx, points[1].cx]).toContain(s.x)
    expect([0, Math.PI]).toContain(s.rotY)

    // Ближе к первой секции — стоит на первой
    const near = samplePath(points, dock(0) + span * 0.2, VH, VW, true)
    expect(near.x).toBe(points[0].cx)
    expect(near.size).toBe(points[0].size)
  })

  it('положение непрерывно на стыке сегментов', () => {
    const eps = 0.01
    const a = samplePath(points, dock(1) - eps, VH, VW)
    const b = samplePath(points, dock(1) + eps, VH, VW)
    expect(Math.abs(a.x - b.x)).toBeLessThan(1)
    expect(Math.abs(a.y - b.y)).toBeLessThan(1)
    expect(Math.abs(a.size - b.size)).toBeLessThan(1)
  })
})
