import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import { describe, expect, it } from 'vitest'

/**
 * Контракт на модели, выходящие из scripts/optimize-coin.mjs.
 *
 * Исходники от дизайнера в репозиторий не попадают (по 95 МБ), поэтому
 * тест проверяет результат конвейера — то, что реально уезжает в браузер.
 * Смысл проверок: приложение считает монету нормализованной (центр в нуле,
 * диаметр 1, толщина по Z) и строит на этом всю математику траектории.
 * Если конвейер это сломает, монета уедет мимо якорей, и упасть должно
 * здесь, а не в браузере.
 *
 * Читаем через gltf-transform, а не через GLTFLoader: текстуры теперь
 * в WebP, а его декодирование three перекладывает на браузер и в Node
 * падает на отсутствующем self. Нам всё равно нужна структура файла,
 * а не пиксели.
 */
const SIDES = ['coin-obverse.glb', 'coin-reverse.glb'] as const

async function load(name: string) {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
  })
  return io.read(resolve(import.meta.dirname, '../../public/models', name))
}

describe.each(SIDES)('модель монеты: %s', (name) => {
  it('отцентрована, диаметр ровно 1, толщина по Z', async () => {
    const doc = await load(name)
    const { min, max } = getBounds(doc.getRoot().listScenes()[0])
    const size = max.map((v, i) => v - min[i])
    const center = max.map((v, i) => (v + min[i]) / 2)

    expect(Math.abs(center[0])).toBeLessThan(0.005)
    expect(Math.abs(center[1])).toBeLessThan(0.005)
    expect(Math.abs(center[2])).toBeLessThan(0.005)

    // Круглая и приведена к единичному диаметру
    expect(Math.max(size[0], size[1])).toBeCloseTo(1, 2)
    expect(size[0]).toBeCloseTo(size[1], 1)
    // Плоская: толщина много меньше диаметра
    expect(size[2]).toBeLessThan(0.15)
  })

  it('несёт запечённый PBR-набор от дизайнера', async () => {
    const doc = await load(name)
    const materials = doc.getRoot().listMaterials()
    expect(materials.length).toBeGreaterThan(0)
    for (const m of materials) {
      // Без карты нормалей пропадает гильош, без карты цвета — металл
      expect(m.getNormalTexture()).toBeTruthy()
      expect(m.getBaseColorTexture()).toBeTruthy()
    }
  })

  it('текстуры ужаты и переведены в WebP', async () => {
    const doc = await load(name)
    const textures = doc.getRoot().listTextures()
    expect(textures.length).toBeGreaterThan(0)
    for (const t of textures) {
      expect(t.getMimeType()).toBe('image/webp')
      // 4096 от дизайнера — втрое больше, чем нужно монете на 360 CSS-пикселей
      expect(Math.max(...t.getSize()!)).toBeLessThanOrEqual(2048)
    }
  })

  it('децимирована до вебовского бюджета', async () => {
    const doc = await load(name)
    let tris = 0
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices()
        tris += (idx ? idx.getCount() : prim.getAttribute('POSITION')!.getCount()) / 3
      }
    }
    // Исходник — 1.5 млн; на экране монета не больше 360 CSS-пикселей
    expect(tris).toBeGreaterThan(10_000)
    expect(tris).toBeLessThan(80_000)
  })
})
