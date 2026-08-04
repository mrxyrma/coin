import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { coinPath } from '../lib/useCoinEngine'
import { invalidateCoin } from '../lib/coinStore'
import { CASE_VIEW_TILT, CASE_VIEW_TURN } from '../lib/trajectory'

export const CASE_MODEL_URL = '/models/case.glb'

/** Угол раскрытия крышки. Футляр стоит открытым — монете надо куда падать. */
const OPEN_ANGLE = (108 * Math.PI) / 180

// Ракурс выводится из угла, под которым в футляр ложится монета —
// см. вывод в trajectory.ts
const VIEW_TILT = CASE_VIEW_TILT
const VIEW_TURN = CASE_VIEW_TURN

/**
 * Футляр в секции «упаковка 2».
 *
 * Позиция и размер берутся из DOM-якоря — так же, как у монеты, поэтому
 * футляр остаётся на своём месте в вёрстке на любой ширине экрана.
 *
 * Футляр стоит раскрытым: монета прилетает и остаётся в ложементе.
 * Узел `lid` имеет начало координат на оси петли, поэтому раскрытие —
 * это просто поворот вокруг X.
 */
export function Case({ anchor }: { anchor: string }) {
  const group = useRef<THREE.Group>(null)
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
    // Крышка раскрыта сразу: футляр ждёт монету открытым, а не
    // распахивается по скроллу
    const lid = model.getObjectByName('lid')
    if (lid) lid.rotation.x = -OPEN_ANGLE
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
  })

  return (
    <group ref={group}>
      {/* Модель стоит дном в нуле — поднимаем, чтобы центр был на якоре */}
      <primitive object={model} position={[0, -height / 2, 0]} />
    </group>
  )
}

useGLTF.preload(CASE_MODEL_URL)
