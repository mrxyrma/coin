import { useStore, useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type { PerspectiveCamera } from 'three'

/**
 * Камера, в которой одна мировая единица равна одному CSS-пикселю
 * в плоскости z = 0.
 *
 * Это то, что связывает вёрстку и 3D: позиции монеты приходят из
 * getBoundingClientRect() в пикселях, и их можно класть в сцену без
 * пересчётов. Перспектива при этом сохраняется — при повороте монета
 * ракурсится честно.
 */
export const CAMERA_DISTANCE = 1000

export const fovForViewport = (vh: number) =>
  (2 * Math.atan(vh / 2 / CAMERA_DISTANCE) * 180) / Math.PI

/** Держит fov в соответствии с высотой вьюпорта. */
export function PixelCamera() {
  const store = useStore()
  const height = useThree((s) => s.size.height)

  useLayoutEffect(() => {
    const camera = store.getState().camera as PerspectiveCamera
    camera.position.set(0, 0, CAMERA_DISTANCE)
    camera.fov = fovForViewport(height)
    camera.near = 1
    camera.far = CAMERA_DISTANCE * 3
    camera.updateProjectionMatrix()
  }, [store, height])

  return null
}

/** Перевод координат вьюпорта (px, от левого верхнего угла) в мировые. */
export function toWorld(x: number, y: number, vw: number, vh: number) {
  return { x: x - vw / 2, y: -(y - vh / 2) }
}
