import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { invalidateCoin, type Metal } from '../lib/coinStore'

// BASE_URL, а не «/»: на GitHub Pages сайт живёт в подкаталоге /<repo>/
export const COIN_MODEL_URL = `${import.meta.env.BASE_URL}models/coin-obverse.glb`

/**
 * Модель монеты от дизайнера, пропущенная через scripts/optimize-coin.mjs.
 *
 * В отличие от прежней болванки материал берётся из файла, а не собирается
 * здесь: дизайнер запёк PBR-набор (baseColor, normal, metallicRoughness),
 * и именно он даёт гильош и игру света на рельефе. Наша задача — не
 * испортить его, поэтому трогаем только то, что нужно для смены металла.
 *
 * Модель уже нормализована конвейером: центр в нуле, диаметр ровно 1,
 * плоскость XY, толщина по Z. Никаких поправок на единицы дизайнера.
 */
export function CoinModel({ metal }: { metal: Metal }) {
  const { scene } = useGLTF(COIN_MODEL_URL, false)

  const model = useMemo(() => {
    const model = scene.clone(true)

    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const source = o.material as THREE.MeshStandardMaterial
      const material = source.clone()

      if (metal === 'silver') {
        /*
         * Серебряной версии дизайнер не присылал — обе модели золотые.
         * Пока обесцвечиваем карту цвета: у металла baseColor задаёт
         * оттенок отражения, поэтому серая карта даёт честное серебро,
         * а не золото под синим фильтром. Множитель color здесь бесполезен —
         * он не убирает насыщенность, а только перекрашивает.
         *
         * Это временная мера до нормального серебра от дизайнера.
         */
        if (source.map) material.map = desaturate(source.map)
        material.roughness = Math.max(0, source.roughness - 0.04)
      }

      o.material = material
    })

    return model
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

  return <primitive object={model} />
}

/** Обесцвеченные копии карт: пересчёт пикселей делаем один раз на текстуру. */
const desaturated = new WeakMap<THREE.Texture, THREE.Texture>()

/**
 * Серая копия карты цвета.
 *
 * Считаем яркость вручную, а не через ctx.filter: фильтры canvas
 * появились в Safari только в 16.4, ровно на нижней границе поддержки,
 * и полагаться на них в единственном месте, где ломается металл, не хочется.
 */
function desaturate(texture: THREE.Texture): THREE.Texture {
  const cached = desaturated.get(texture)
  if (cached) return cached

  const image = texture.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return texture

  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    // Коэффициенты Rec. 709: глаз воспринимает зелёный ярче красного и синего
    const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
    // Серебро чуть светлее и холоднее нейтрально-серого
    px[i] = Math.min(255, y * 1.04)
    px[i + 1] = Math.min(255, y * 1.06)
    px[i + 2] = Math.min(255, y * 1.1)
  }
  ctx.putImageData(data, 0, 0)

  const copy = new THREE.CanvasTexture(canvas)
  copy.colorSpace = texture.colorSpace
  copy.flipY = texture.flipY
  copy.wrapS = texture.wrapS
  copy.wrapT = texture.wrapT
  copy.needsUpdate = true
  desaturated.set(texture, copy)
  return copy
}

// false — DRACO не нужен: геометрия сжата meshopt, чей декодер уже в бандле.
// Иначе drei заводит DRACOLoader, который ходит за wasm на gstatic.
useGLTF.preload(COIN_MODEL_URL, false)
