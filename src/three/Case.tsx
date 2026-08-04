import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { coinPath } from '../lib/useCoinEngine'
import { invalidateCoin } from '../lib/coinStore'

export const CASE_MODEL_URL = '/models/case.glb'

/** Максимальный угол раскрытия крышки */
const OPEN_ANGLE = (105 * Math.PI) / 180

/** Ракурс футляра на странице — 3/4 сверху, как на референс-рендере */
const VIEW_TILT = -0.62
const VIEW_TURN = 0.38

/**
 * Футляр в секции «упаковка 2».
 *
 * Позиция и размер берутся из DOM-якоря — так же, как у монеты, поэтому
 * футляр остаётся на своём месте в вёрстке на любой ширине экрана.
 *
 * Крышка открывается по мере того, как секция подходит к центру экрана.
 * Узел `lid` в модели имеет начало координат на оси петли, поэтому
 * достаточно повернуть его вокруг X.
 */
export function Case({ anchor }: { anchor: string }) {
  const group = useRef<THREE.Group>(null)
  const lid = useRef<THREE.Object3D | null>(null)
  const { scene } = useGLTF(CASE_MODEL_URL)
  const size = useThree((s) => s.size)

  const { model, height, width } = useMemo(() => {
    const model = scene.clone(true)
    const box = new THREE.Box3().setFromObject(model)
    const s = new THREE.Vector3()
    box.getSize(s)
    return { model, height: s.y, width: s.x }
  }, [scene])

  useEffect(() => {
    lid.current = model.getObjectByName('lid') ?? null
    invalidateCoin()
  }, [model])

  useFrame(() => {
    const g = group.current
    if (!g || !coinPath.ready) return

    const s = coinPath.sampleStatic(anchor, window.scrollY)
    if (!s) {
      g.visible = false
      return
    }

    const vh = size.height
    const half = s.size / 2
    g.visible = s.y > -vh - half && s.y < vh * 2 + half

    g.position.set(s.x - size.width / 2, -(s.y - vh / 2), 0)
    g.scale.setScalar(s.size / width)
    g.rotation.set(VIEW_TILT, VIEW_TURN, 0)

    // Крышка раскрыта тем сильнее, чем ближе секция к центру экрана
    if (lid.current) {
      const centered = 1 - Math.min(1, Math.abs(s.y - vh / 2) / (vh * 0.55))
      lid.current.rotation.x = -OPEN_ANGLE * centered * centered
    }
  })

  return (
    <group ref={group}>
      {/* Модель стоит дном в нуле — поднимаем, чтобы центр был на якоре */}
      <primitive object={model} position={[0, -height / 2, 0]} />
    </group>
  )
}

useGLTF.preload(CASE_MODEL_URL)
