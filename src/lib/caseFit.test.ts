import { Euler, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CASE_TILT, CASE_VIEW_TILT, TRAJECTORY } from './trajectory'

/**
 * Монета должна лечь в ложемент плашмя, а не воткнуться в него под углом.
 *
 * Проверяется в цифрах, потому что на глаз рассогласование в 10–15°
 * читается просто как «наклон какой-то не такой» — ровно так эта ошибка
 * и проявилась в первый раз.
 */
describe('монета и футляр согласованы по наклону', () => {
  it('плоскость монеты параллельна дну ложемента', () => {
    // Монета — диск с нормалью +Z, повёрнутый на CASE_TILT вокруг X
    const coinNormal = new Vector3(0, 0, 1).applyEuler(
      new Euler(CASE_TILT, 0, 0),
    )
    // Футляр стоит дном в плоскости XZ, его нормаль +Y
    const caseNormal = new Vector3(0, 1, 0).applyEuler(
      new Euler(CASE_VIEW_TILT, 0, 0),
    )

    // Параллельны — значит косинус угла между ними равен единице
    expect(coinNormal.dot(caseNormal)).toBeCloseTo(1, 6)
  })

  it('угол укладки взят из макета, а не подобран', () => {
    // Эллипс монеты в футляре: 206×144 → cos θ = 144/206
    expect(Math.cos(CASE_TILT)).toBeCloseTo(144 / 206, 6)
  })

  it('траектория заканчивается футляром — монета остаётся в нём', () => {
    const last = TRAJECTORY[TRAJECTORY.length - 1]
    expect(last.id).toBe('case')
    expect(last.rotX).toBeCloseTo(CASE_TILT, 6)
  })

  it('в футляр монета приходит уже наклонённой, а не падает плашмя', () => {
    const acrylic = TRAJECTORY.find((w) => w.id === 'case-acrylic')!
    // Завал начинается на подлёте: на акриловом футляре половина угла
    expect(acrylic.rotX).toBeLessThan(0)
    expect(acrylic.rotX).toBeGreaterThan(CASE_TILT)
  })
})
