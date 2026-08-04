import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { coinPath } from '../lib/useCoinEngine'
import { coinUi, reportSide, useMetal, type Metal } from '../lib/coinStore'
import { makeFaceTexture } from './placeholderTexture'

export type { Metal }

/** Диаметр болванки в мировых единицах (CylinderGeometry radius = 1) */
const MODEL_DIAMETER = 2

const METAL = {
  gold: { color: '#c9a227', roughness: 0.22 },
  silver: { color: '#cfd3d8', roughness: 0.18 },
} as const

function useCoinMaterials(metal: Metal) {
  return useMemo(() => {
    const { color, roughness } = METAL[metal]
    const common = { color: new THREE.Color(color), metalness: 1, roughness }

    const obverse = makeFaceTexture('АВЕРС', metal)
    const reverse = makeFaceTexture('РЕВЕРС', metal)

    // Порядок материалов CylinderGeometry: [боковина, верх, низ].
    // Меш повёрнут на +90° по X, поэтому «верх» смотрит в камеру.
    const materials = [
      new THREE.MeshStandardMaterial({ ...common, roughness: roughness + 0.1 }),
      new THREE.MeshStandardMaterial({ ...common, map: obverse }),
      new THREE.MeshStandardMaterial({ ...common, map: reverse }),
    ]

    return { materials, textures: [obverse, reverse] }
  }, [metal])
}

type CoinProps = {
  /** Явный металл. Если не задан — берётся из стора (табы Золото/Серебро). */
  metal?: Metal
  /** Статичный якорь вместо полёта по траектории (вторая монета на первом экране) */
  staticAnchor?: string
}

export function Coin({ metal, staticAnchor }: CoinProps) {
  const group = useRef<THREE.Group>(null)
  const storeMetal = useMetal()
  const { materials, textures } = useCoinMaterials(metal ?? storeMetal)
  const size = useThree((s) => s.size)

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    }
  }, [materials, textures])

  useFrame(() => {
    const g = group.current
    if (!g || !coinPath.ready) return

    const vw = size.width
    const vh = size.height
    const s = staticAnchor
      ? coinPath.sampleStatic(staticAnchor, window.scrollY)
      : coinPath.sample(window.scrollY, vh)

    if (!s) {
      g.visible = false
      return
    }

    // Отсечение за пределами экрана: монета может быть далеко сверху/снизу
    const half = s.size / 2
    g.visible = s.y > -vh - half && s.y < vh * 2 + half

    // Обороты по скроллу и доворот от клика складываются, а не спорят
    const rotY = staticAnchor ? s.rotY : s.rotY + coinUi.rotY

    // Позиции приходят в CSS-пикселях — камера настроена 1:1, пересчёт не нужен
    g.position.set(s.x - vw / 2, -(s.y - vh / 2), 0)
    g.scale.setScalar(s.size / MODEL_DIAMETER)
    g.rotation.set(s.rotX, rotY, 0)

    if (!staticAnchor) {
      reportSide(Math.cos(rotY) >= 0 ? 'obverse' : 'reverse')
    }
  })

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materials}>
        <cylinderGeometry args={[1, 1, 0.12, 128]} />
      </mesh>
    </group>
  )
}
