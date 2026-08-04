import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { invalidateCoin, type Metal } from '../lib/coinStore'

export const COIN_MODEL_URL = '/models/coin.glb'

const METAL = {
  gold: { color: '#c9a227', roughness: 0.24 },
  silver: { color: '#cfd3d8', roughness: 0.2 },
} as const

/**
 * Пробная модель монеты из scripts/make-coin.mjs.
 *
 * Структура повторяет то, что запрошено у дизайнера: отдельные объекты
 * obverse / reverse / rim. Материалы назначаются здесь, а не берутся из
 * файла, — так же будет и с настоящей моделью: от неё нужна геометрия,
 * а металл настраивается под веб.
 */
export function CoinModel({ metal }: { metal: Metal }) {
  const { scene } = useGLTF(COIN_MODEL_URL)

  const { model, diameter } = useMemo(() => {
    const { color, roughness } = METAL[metal]

    const face = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 1,
      roughness,
    })
    // Гурт матовее поля: насечка рассеивает свет
    const rim = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 1,
      roughness: roughness + 0.12,
    })

    const model = scene.clone(true)
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = o.name === 'rim' ? rim : face
      }
    })

    const box = new THREE.Box3().setFromObject(model)
    const s = new THREE.Vector3()
    box.getSize(s)

    return { model, diameter: Math.max(s.x, s.y), materials: [face, rim] }
  }, [scene, metal])

  useEffect(() => {
    // Модель встала на место, но скролл мог не двигаться — просим кадр
    invalidateCoin()
    return () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
    }
  }, [model])

  // Приводим модель к диаметру 1, чтобы внешний масштаб задавался
  // размером якоря в пикселях и не зависел от единиц модели
  return <primitive object={model} scale={1 / diameter} />
}

useGLTF.preload(COIN_MODEL_URL)
