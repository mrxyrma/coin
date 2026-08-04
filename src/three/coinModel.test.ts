import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Box3, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'

/**
 * Проверка пробной модели из scripts/make-coin.mjs.
 *
 * Смысл теста — не «красиво ли выглядит», а что файл соответствует
 * контракту, который приложение и ТЗ дизайнеру предполагают: три
 * именованных объекта, монета в центре координат, круглая и плоская.
 * Настоящая модель должна пройти этот же тест.
 */
const GLB = resolve(import.meta.dirname, '../../public/models/coin.glb')

function loadCoin() {
  const buf = readFileSync(GLB)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Promise<import('three').Group>((ok, fail) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (g) => ok(g.scene), fail)
  })
}

describe('модель монеты', () => {
  it('состоит из аверса, реверса и гурта отдельными объектами', async () => {
    const scene = await loadCoin()
    const names: string[] = []
    scene.traverse((o) => {
      if (o instanceof Mesh) names.push(o.name)
    })
    expect(names.sort()).toEqual(['obverse', 'reverse', 'rim'])
  })

  it('отцентрована и имеет пропорции монеты', async () => {
    const scene = await loadCoin()
    const box = new Box3().setFromObject(scene)

    const center = new Vector3()
    box.getCenter(center)
    expect(Math.abs(center.x)).toBeLessThan(0.01)
    expect(Math.abs(center.y)).toBeLessThan(0.01)

    const size = new Vector3()
    box.getSize(size)
    // Круглая: ширина и высота совпадают
    expect(size.x).toBeCloseTo(size.y, 2)
    // Плоская: толщина много меньше диаметра
    expect(size.z).toBeLessThan(size.x * 0.15)
  })

  it('рельеф действительно выступает над полем', async () => {
    const scene = await loadCoin()
    const obverse = scene.getObjectByName('obverse') as Mesh
    const box = new Box3().setFromObject(obverse)
    // Аверс уходит выше половины толщины заготовки — значит объём есть,
    // а не только карта нормалей
    expect(box.max.z).toBeGreaterThan(0.06)
  })
})
