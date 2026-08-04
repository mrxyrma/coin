import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useStore, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { coinPath } from '../lib/useCoinEngine'
import { invalidateCoin } from '../lib/coinStore'
import { caseSlot } from '../lib/caseSlot'
import { CASE_VIEW_TILT, CASE_VIEW_TURN } from '../lib/trajectory'

export const CASE_MODEL_URL = '/models/case.glb'

/** Угол раскрытия крышки. Футляр стоит открытым — монете надо куда падать. */
const OPEN_ANGLE = (108 * Math.PI) / 180

// Ракурс выводится из угла, под которым в футляр ложится монета —
// см. вывод в trajectory.ts
const VIEW_TILT = CASE_VIEW_TILT
const VIEW_TURN = CASE_VIEW_TURN

/**
 * Габарит модели после поворота.
 *
 * Масштабировать по исходной ширине нельзя: наклон на 44° разворачивает
 * глубину футляра в высоту, и на экране он получается заметно крупнее
 * своего якоря. Меряем то, что реально займёт места на экране.
 */
function projectedSize(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object)
  const rot = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(VIEW_TILT, VIEW_TURN, 0),
  )

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const corner = new THREE.Vector3()
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z).applyMatrix4(rot)
        minX = Math.min(minX, corner.x)
        maxX = Math.max(maxX, corner.x)
        minY = Math.min(minY, corner.y)
        maxY = Math.max(maxY, corner.y)
      }
    }
  }

  return { width: maxX - minX, height: maxY - minY }
}

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
  const store = useStore()
  const size = useThree((s) => s.size)

  const { model, height, fitWidth, slotLocal, slotRadius } = useMemo(() => {
    const model = scene.clone(true)

    const lid = model.getObjectByName('lid')
    if (lid) lid.rotation.x = -OPEN_ANGLE
    model.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(model)
    const s = new THREE.Vector3()
    box.getSize(s)

    // Центр углубления: середина ложемента, на уровне его поверхности
    const tray = model.getObjectByName('tray')
    const tb = new THREE.Box3().setFromObject(tray ?? model)
    const slotLocal = new THREE.Vector3(
      (tb.min.x + tb.max.x) / 2,
      tb.max.y,
      (tb.min.z + tb.max.z) / 2,
    )

    return {
      model,
      height: s.y,
      fitWidth: projectedSize(model).width,
      slotLocal,
      // Вырез в ложементе — 0.175 ширины футляра, см. scripts/make-case.mjs
      slotRadius: s.x * 0.175,
    }
  }, [scene])

  useEffect(() => {
    invalidateCoin()
    return () => {
      caseSlot.ready = false
    }
  }, [model])

  useFrame(() => {
    const g = group.current
    if (!g || !coinPath.ready) return

    const s = coinPath.sampleStatic(anchor, window.scrollY)
    if (!s) {
      g.visible = false
      caseSlot.ready = false
      return
    }

    const vh = size.height
    const vw = size.width
    const half = s.size / 2
    g.visible = s.y > -vh - half && s.y < vh * 2 + half

    g.position.set(s.x - vw / 2, -(s.y - vh / 2), 0)
    g.scale.setScalar(s.size / fitWidth)
    g.rotation.set(VIEW_TILT, VIEW_TURN, 0)
    g.updateMatrixWorld(true)

    // Проецируем углубление обратно в пиксели — туда прицелится монета
    const camera = store.getState().camera
    const world = slotLocal.clone().applyMatrix4(model.matrixWorld)
    const edge = slotLocal
      .clone()
      .add(new THREE.Vector3(slotRadius, 0, 0))
      .applyMatrix4(model.matrixWorld)

    const toScreen = (v: THREE.Vector3) => {
      const p = v.clone().project(camera)
      return { x: (p.x * 0.5 + 0.5) * vw, y: (1 - (p.y * 0.5 + 0.5)) * vh }
    }

    const c = toScreen(world)
    const e = toScreen(edge)

    caseSlot.x = c.x
    caseSlot.y = c.y
    caseSlot.size = Math.hypot(e.x - c.x, e.y - c.y) * 2
    caseSlot.ready = g.visible
  })

  return (
    <group ref={group}>
      {/* Модель стоит дном в нуле — поднимаем, чтобы центр был на якоре */}
      <primitive object={model} position={[0, -height / 2, 0]} />
    </group>
  )
}

useGLTF.preload(CASE_MODEL_URL)
