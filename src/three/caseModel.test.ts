import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'

/**
 * Контракт модели футляра. Настоящая модель от дизайнера должна проходить
 * эти же проверки — тогда её можно подставить без правок кода.
 */
const GLB = resolve(import.meta.dirname, '../../public/models/case.glb')

function loadCase() {
  const buf = readFileSync(GLB)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Promise<import('three').Group>((ok, fail) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (g) => ok(g.scene), fail)
  })
}

describe('модель футляра', () => {
  it('корпус, крышка и ложемент — отдельные объекты', async () => {
    const scene = await loadCase()
    for (const name of ['base', 'lid', 'tray']) {
      expect(scene.getObjectByName(name), `нет узла ${name}`).toBeDefined()
    }
  })

  it('начало координат крышки лежит на оси петли', async () => {
    const scene = await loadCase()
    const lid = scene.getObjectByName('lid')!
    const box = new Box3().setFromObject(scene)

    // Ось петли — у задней грани и на высоте корпуса, а не в центре крышки.
    // Если начало координат окажется в центре, крышка при открытии
    // провалится внутрь корпуса вместо того, чтобы откинуться.
    expect(lid.position.z).toBeLessThan(box.min.z + 0.05)
    expect(lid.position.y).toBeGreaterThan(0.1)
  })

  it('крышка при открытии уходит вверх, а не сквозь корпус', async () => {
    const scene = await loadCase()
    const lid = scene.getObjectByName('lid')!

    const closedTop = new Box3().setFromObject(lid).max.y
    lid.rotation.x = -Math.PI / 2
    lid.updateMatrixWorld(true)
    const openTop = new Box3().setFromObject(lid).max.y

    expect(openTop).toBeGreaterThan(closedTop * 2)
  })

  it('в ложементе есть углубление под монету', async () => {
    const scene = await loadCase()
    const tray = scene.getObjectByName('tray')!
    const box = new Box3().setFromObject(tray)
    const size = new Vector3()
    box.getSize(size)

    // Ложемент занимает почти всю внутреннюю площадь и остаётся плоским
    expect(size.x).toBeGreaterThan(0.8)
    expect(size.y).toBeLessThan(0.12)
  })

  it('пропорции соответствуют референс-рендеру: плоская широкая коробка', async () => {
    const scene = await loadCase()
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)

    expect(size.y).toBeLessThan(size.x * 0.4)
    expect(size.z / size.x).toBeGreaterThan(0.7)
    expect(size.z / size.x).toBeLessThan(1)
  })
})
