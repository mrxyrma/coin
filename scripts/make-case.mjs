/**
 * Генератор черновой модели футляра → public/models/case.glb
 *
 * Собран по референс-рендеру из Figma (узел 2:9): чёрный матовый футляр,
 * на крышке глянцевое тиснение — веерный «луч времени», сбоку зелёный
 * язычок. Крышка на петле по задней грани.
 *
 * Задача та же, что и у пробной монеты: проверить сцену укладки до
 * получения настоящей модели. Поэтому структура объектов повторяет
 * запрошенную у дизайнера: base / lid / tray отдельно, у крышки
 * начало координат лежит на оси петли — иначе она открывалась бы
 * вокруг своего центра, а не вокруг шарнира.
 *
 * Запуск: node scripts/make-case.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// GLTFExporter вычитывает бинарный чанк через FileReader, которого в Node нет
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReaderShim {
    result = null
    onloadend = null
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        this.onloadend?.()
      })
    }
  }
}

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/models/case.glb',
)

// Пропорции сняты с референс-рендера. Ширина 1 — приложение
// масштабирует футляр по размеру якоря в вёрстке.
const W = 1
const D = 0.86
const BASE_H = 0.2
const LID_H = 0.075
const WALL = 0.035
const R = 0.012 // скругление рёбер

/** Радиус углубления под монету в ложементе (в макете монета ≈32% ширины) */
const COIN_R = 0.175

const MATTE = new THREE.MeshStandardMaterial({
  name: 'CaseMatte',
  color: 0x121212,
  metalness: 0,
  roughness: 0.62,
})
/** Тиснение на крышке глянцевее матового поля — так оно и читается на рендере */
const GLOSS = new THREE.MeshStandardMaterial({
  name: 'CaseGloss',
  color: 0x171717,
  metalness: 0.1,
  roughness: 0.16,
})
const FELT = new THREE.MeshStandardMaterial({
  name: 'CaseFelt',
  color: 0x0d0d0d,
  metalness: 0,
  roughness: 0.95,
})
const GREEN = new THREE.MeshStandardMaterial({
  name: 'CaseTab',
  color: 0xa3cd39,
  metalness: 0,
  roughness: 0.7,
})

/**
 * Корпус: дно и четыре стенки.
 *
 * Сплошной коробкой обойтись нельзя — когда крышка откроется, внутри
 * должна быть полость с ложементом, а не монолит.
 */
function makeBase() {
  const base = new THREE.Group()
  base.name = 'base'

  const bottom = new THREE.Mesh(
    new RoundedBoxGeometry(W, WALL, D, 2, R),
    MATTE,
  )
  bottom.position.y = WALL / 2
  base.add(bottom)

  const sideGeo = new RoundedBoxGeometry(WALL, BASE_H, D, 2, R)
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(sideGeo, MATTE)
    wall.position.set((sx * (W - WALL)) / 2, BASE_H / 2, 0)
    base.add(wall)
  }

  const endGeo = new RoundedBoxGeometry(W - WALL * 2, BASE_H, WALL, 2, R)
  for (const sz of [-1, 1]) {
    const wall = new THREE.Mesh(endGeo, MATTE)
    wall.position.set(0, BASE_H / 2, (sz * (D - WALL)) / 2)
    base.add(wall)
  }

  return base
}

/**
 * Ложемент: пластина с круглым вырезом под монету и дном под ним.
 * Вырез делается дыркой в Shape — так получается настоящее углубление,
 * в которое монета садится, а не лежит поверх.
 */
function makeTray() {
  const tray = new THREE.Group()
  tray.name = 'tray'

  const innerW = W - WALL * 2.4
  const innerD = D - WALL * 2.4

  const shape = new THREE.Shape()
  shape.moveTo(-innerW / 2, -innerD / 2)
  shape.lineTo(innerW / 2, -innerD / 2)
  shape.lineTo(innerW / 2, innerD / 2)
  shape.lineTo(-innerW / 2, innerD / 2)
  shape.closePath()

  const hole = new THREE.Path()
  hole.absarc(0, 0, COIN_R, 0, Math.PI * 2, true)
  shape.holes.push(hole)

  const plateH = 0.05
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: plateH, bevelEnabled: false, curveSegments: 64 }),
    FELT,
  )
  // ExtrudeGeometry строит в плоскости XY и тянет по Z — кладём плашмя
  plate.rotation.x = -Math.PI / 2
  plate.position.y = BASE_H - plateH * 0.35
  tray.add(plate)

  // Дно углубления, чтобы сквозь вырез не просвечивал корпус
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(COIN_R * 1.02, COIN_R * 1.02, 0.01, 64),
    FELT,
  )
  floor.position.y = BASE_H - plateH * 0.35 - plateH + 0.005
  tray.add(floor)

  return tray
}

/**
 * Веерное тиснение «луч времени».
 *
 * На референсе лучи расходятся от передней кромки крышки веером назад,
 * с неровным внешним краем. Каждый луч — тонкая планка, приподнятая
 * над полем и с более глянцевым материалом.
 */
function makeRays(topY) {
  const rays = new THREE.Group()
  rays.name = 'pattern'

  /*
   * Координаты локальные для крышки, а её начало координат лежит на оси
   * петли — значит поле крышки это z от 0 (петля) до D (передняя кромка).
   * Вершина веера у передней кромки, лучи идут назад.
   */
  const apexZ = D * 0.9
  const count = 46
  const spread = Math.PI * 0.86
  const margin = 0.055

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const angle = -spread / 2 + spread * t

    // Длину ограничиваем краями крышки, иначе крайние лучи вылезают наружу
    const dx = Math.abs(Math.sin(angle))
    const dz = Math.abs(Math.cos(angle))
    const limitX = dx > 1e-4 ? (W / 2 - margin) / dx : Infinity
    const limitZ = dz > 1e-4 ? (apexZ - margin) / dz : Infinity

    // Неровный край: длина лучей гуляет — на рендере он ступенчатый
    const wobble = 0.5 + 0.5 * Math.cos(t * Math.PI * 7)
    const len = Math.min(limitX, limitZ) * (0.74 + 0.26 * wobble)
    const width = 0.006 + 0.004 * (1 - Math.abs(t - 0.5) * 2)

    const ray = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.004, len),
      GLOSS,
    )
    // Планку сдвигаем на половину длины, чтобы она росла от вершины веера
    ray.position.set(
      Math.sin(angle) * (len / 2),
      topY + 0.002,
      apexZ - Math.cos(angle) * (len / 2),
    )
    ray.rotation.y = angle
    rays.add(ray)
  }

  return rays
}

/**
 * Крышка. Начало координат — на оси петли (задняя грань, верх корпуса),
 * поэтому открывается поворотом вокруг X без дополнительных сдвигов.
 */
function makeLid() {
  const lid = new THREE.Group()
  lid.name = 'lid'
  lid.position.set(0, BASE_H, -D / 2)

  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(W, LID_H, D, 2, R),
    MATTE,
  )
  // Смещаем геометрию вперёд и вверх от оси петли
  shell.position.set(0, LID_H / 2, D / 2)
  lid.add(shell)

  lid.add(makeRays(LID_H))

  return lid
}

/** Зелёный язычок сбоку */
function makeTab() {
  const tab = new THREE.Mesh(
    new RoundedBoxGeometry(0.05, 0.035, 0.09, 2, 0.008),
    GREEN,
  )
  tab.name = 'tab'
  tab.position.set(-(W / 2) - 0.008, BASE_H - 0.045, D * 0.12)
  return tab
}

const root = new THREE.Group()
root.name = 'Case'
root.add(makeBase(), makeTray(), makeLid(), makeTab())

// Приводим к началу координат по горизонтали, дно на y = 0
const box = new THREE.Box3().setFromObject(root)
const size = new THREE.Vector3()
box.getSize(size)

let tris = 0
root.traverse((o) => {
  if (o.isMesh) {
    const g = o.geometry
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3
  }
})

new GLTFExporter().parse(
  root,
  (glb) => {
    mkdirSync(dirname(OUT), { recursive: true })
    const buffer = Buffer.from(glb)
    writeFileSync(OUT, buffer)
    console.log(
      `${OUT}\n  ${Math.round(tris).toLocaleString('ru')} треугольников, ` +
        `${(buffer.length / 1024).toFixed(0)} КБ\n` +
        `  габарит ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
    )
  },
  (err) => {
    console.error('Экспорт не удался:', err)
    process.exitCode = 1
  },
  { binary: true },
)
