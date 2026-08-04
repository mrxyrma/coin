import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { coinPath } from '../lib/useCoinEngine'
import { coinUi, reportSide, useMetal, type Metal } from '../lib/coinStore'
import { makeFaceTexture } from './placeholderTexture'
import { CoinModel } from './CoinModel'

export type { Metal }

/** Модель нормализована к диаметру 1 — внешний масштаб задаётся якорем */
const MODEL_DIAMETER = 1

const METAL = {
  gold: { color: '#c9a227', roughness: 0.22 },
  silver: { color: '#cfd3d8', roughness: 0.18 },
} as const

/**
 * Заглушка на время загрузки GLB и на случай, если файла нет.
 * Плоский цилиндр с нарисованными сторонами — видно, что монета крутится,
 * даже если модель не приехала.
 */
function CoinFallback({ metal }: { metal: Metal }) {
  const { materials, textures } = useMemo(() => {
    const { color, roughness } = METAL[metal]
    const common = { color: new THREE.Color(color), metalness: 1, roughness }

    const obverse = makeFaceTexture('АВЕРС', metal)
    const reverse = makeFaceTexture('РЕВЕРС', metal)

    // Порядок материалов CylinderGeometry: [боковина, верх, низ]
    const materials = [
      new THREE.MeshStandardMaterial({ ...common, roughness: roughness + 0.1 }),
      new THREE.MeshStandardMaterial({ ...common, map: obverse }),
      new THREE.MeshStandardMaterial({ ...common, map: reverse }),
    ]
    return { materials, textures: [obverse, reverse] }
  }, [metal])

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    }
  }, [materials, textures])

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} material={materials} scale={0.5}>
      <cylinderGeometry args={[1, 1, 0.11, 128]} />
    </mesh>
  )
}

/**
 * Если GLB не загрузился — показываем заглушку вместо падения всей сцены.
 * Suspense ловит только ожидание, но не ошибку загрузки.
 */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('Модель монеты не загрузилась, показываем заглушку:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
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
  const activeMetal = metal ?? storeMetal
  const size = useThree((s) => s.size)

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

  const fallback = <CoinFallback metal={activeMetal} />

  return (
    <group ref={group}>
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <CoinModel metal={activeMetal} />
        </Suspense>
      </ModelBoundary>
    </group>
  )
}
