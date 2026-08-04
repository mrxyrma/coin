/**
 * Генератор пробной модели монеты → public/models/coin.glb
 *
 * Нужен, чтобы проверить боевой конвейер до получения настоящей модели:
 * загрузку GLB, разделение на аверс / реверс / гурт отдельными объектами,
 * назначение PBR-металла и масштабирование по якорям вёрстки.
 *
 * Рельеф делается настоящей геометрией, а не картой нормалей: на силуэте
 * при повороте монеты видно, что он реально выступает — именно это
 * проверяем перед заказом Ultra High Relief.
 *
 * Запуск: node scripts/make-coin.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/*
 * GLTFExporter рассчитан на браузер: бинарный чанк он вычитывает из Blob
 * через FileReader, которого в Node нет. Подменяем минимальной реализацией
 * поверх Blob.arrayBuffer() — экспортеру нужен только readAsArrayBuffer.
 */
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
  '../public/models/coin.glb',
)

// Монета радиусом 1 — приложение масштабирует её по размеру якоря
const R = 1
const THICKNESS = 0.11
/** Насколько сильно рельеф выступает над полем монеты */
const RELIEF = 0.055
/** Число насечек по гурту */
const REEDS = 140

const ANGULAR = 320
const RADIAL = 96

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** Полоса: 1 внутри [a,b], со сглаженными краями шириной f */
const band = (x, a, b, f) => smoothstep(a - f, a + f, x) * (1 - smoothstep(b - f, b + f, x))

/**
 * Аверс. Абстракция на тему макета: приподнятый кант, поле с гильошировкой
 * и выступающий «луч времени», уходящий из центра к краю.
 */
function obverseHeight(r, theta) {
  let h = 0

  // Кант по краю
  h += band(r, 0.87, 0.965, 0.012) * 0.55

  // Гильошировка: интерференция концентрических и радиальных волн
  const guilloche =
    Math.sin(r * 130) * 0.5 + Math.sin(theta * 26 + r * 40) * 0.5
  h += guilloche * 0.07 * band(r, 0.06, 0.86, 0.05)

  // «Луч времени» — выступающий клин из центра
  const beamAngle = Math.PI * 0.32
  let d = ((theta - beamAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  const beam = Math.exp(-((d / 0.34) ** 2)) * smoothstep(0.04, 0.5, r)
  h += beam * 0.85 * (1 - smoothstep(0.8, 0.95, r))

  // Центральный купол — «объём» вместо пеликана
  h += Math.cos(Math.min(1, r / 0.24) * Math.PI * 0.5) * 0.9 * (1 - smoothstep(0.2, 0.26, r))

  return h
}

/** Реверс: кант, концентрические кольца и радиальные лучи. */
function reverseHeight(r, theta) {
  let h = 0
  h += band(r, 0.87, 0.965, 0.012) * 0.55

  const rings = Math.sin(r * 46) * 0.5 + 0.5
  h += rings * 0.28 * band(r, 0.3, 0.85, 0.05)

  const rays = Math.max(0, Math.cos(theta * 18))
  h += rays ** 6 * 0.4 * band(r, 0.1, 0.3, 0.04)

  h += (1 - smoothstep(0.05, 0.1, r)) * 0.5
  return h
}

/** Радиус с насечкой: работает только у самой кромки, поле не трогает */
function reededRadius(r, theta) {
  const notch = (0.5 + 0.5 * Math.cos(theta * REEDS)) * 0.012
  return R * r * (1 - notch * smoothstep(0.94, 1, r))
}

/**
 * Диск в полярной сетке. sign = +1 (аверс, к камере) или −1 (реверс).
 */
function makeFace(heightFn, sign) {
  const positions = []
  const indices = []

  for (let i = 0; i <= RADIAL; i++) {
    // Сгущаем кольца к краю: там кант и насечка
    const r = (i / RADIAL) ** 0.85
    for (let j = 0; j <= ANGULAR; j++) {
      const theta = (j / ANGULAR) * Math.PI * 2
      const rad = reededRadius(r, theta)
      const z = sign * (THICKNESS / 2 + heightFn(r, theta) * RELIEF)
      positions.push(Math.cos(theta) * rad, Math.sin(theta) * rad, z)
    }
  }

  const row = ANGULAR + 1
  for (let i = 0; i < RADIAL; i++) {
    for (let j = 0; j < ANGULAR; j++) {
      const a = i * row + j
      const b = a + row
      // Порядок обхода зеркалим, чтобы нормали смотрели наружу с обеих сторон
      if (sign > 0) indices.push(a, b, a + 1, a + 1, b, b + 1)
      else indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Гурт: стенка между кромками аверса и реверса, с насечкой */
function makeRim() {
  const positions = []
  const indices = []

  for (let j = 0; j <= ANGULAR; j++) {
    const theta = (j / ANGULAR) * Math.PI * 2
    const rad = reededRadius(1, theta)
    const zTop = THICKNESS / 2 + obverseHeight(1, theta) * RELIEF
    const zBottom = -(THICKNESS / 2 + reverseHeight(1, theta) * RELIEF)
    positions.push(Math.cos(theta) * rad, Math.sin(theta) * rad, zTop)
    positions.push(Math.cos(theta) * rad, Math.sin(theta) * rad, zBottom)
  }

  for (let j = 0; j < ANGULAR; j++) {
    const a = j * 2
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

// Материалы без текстур: цвет металла приложение переопределяет,
// от модели нужна геометрия и понятная структура объектов
const faceMaterial = new THREE.MeshStandardMaterial({
  name: 'CoinMetal',
  color: 0xc9a227,
  metalness: 1,
  roughness: 0.24,
})
const rimMaterial = new THREE.MeshStandardMaterial({
  name: 'CoinRim',
  color: 0xc9a227,
  metalness: 1,
  roughness: 0.34,
})

const group = new THREE.Group()
group.name = 'Coin'

// Имена важны: приложение находит стороны по ним, как и в настоящей модели
const obverse = new THREE.Mesh(makeFace(obverseHeight, 1), faceMaterial)
obverse.name = 'obverse'
const reverse = new THREE.Mesh(makeFace(reverseHeight, -1), faceMaterial)
reverse.name = 'reverse'
const rim = new THREE.Mesh(makeRim(), rimMaterial)
rim.name = 'rim'

group.add(obverse, reverse, rim)

const tris =
  (obverse.geometry.index.count + reverse.geometry.index.count + rim.geometry.index.count) / 3

new GLTFExporter().parse(
  group,
  (glb) => {
    mkdirSync(dirname(OUT), { recursive: true })
    const buffer = Buffer.from(glb)
    writeFileSync(OUT, buffer)
    console.log(
      `${OUT}\n  ${tris.toLocaleString('ru')} треугольников, ${(buffer.length / 1024 / 1024).toFixed(2)} МБ`,
    )
  },
  (err) => {
    console.error('Экспорт не удался:', err)
    process.exitCode = 1
  },
  { binary: true },
)
