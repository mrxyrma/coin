import { useSyncExternalStore } from 'react'
import { gsap } from './scroll'

export type Metal = 'gold' | 'silver'
export type Side = 'obverse' | 'reverse'

/**
 * Состояние монеты, которое видит React.
 *
 * Здесь только то, что меняется от действий пользователя — металл и видимая
 * сторона. Позиция и угол по скроллу сюда НЕ попадают: они меняются каждый
 * кадр, и любой ре-рендер на них убил бы производительность. Их читает
 * напрямую кадровый цикл из coinPath.
 */
let metal: Metal = 'gold'
let side: Side = 'obverse'

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function setMetal(next: Metal) {
  if (next === metal) return
  metal = next
  emit()
}

/** Вызывается из кадрового цикла — только когда сторона реально сменилась. */
export function reportSide(next: Side) {
  if (next === side) return
  side = next
  emit()
}

export const useMetal = () => useSyncExternalStore(subscribe, () => metal)
export const useSide = () => useSyncExternalStore(subscribe, () => side)
export const getMetal = () => metal

/**
 * Доворот от пользователя, живущий вне React.
 *
 * Складывается с оборотами по скроллу, поэтому переворот по клику не
 * конфликтует с прокруткой: скролл продолжает крутить монету от текущего
 * положения, а не сбрасывает его.
 */
export const coinUi = { rotY: 0 }

export function flipCoin() {
  gsap.to(coinUi, {
    rotY: coinUi.rotY + Math.PI,
    duration: 0.9,
    ease: 'power2.inOut',
    overwrite: true,
  })
}
