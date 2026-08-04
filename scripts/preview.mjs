/**
 * Офлайн-превью GLB → PNG, без браузера и GPU.
 *
 * Нужен, чтобы проверять сгенерированные модели глазами прямо в терминале:
 * софтверный растеризатор с z-буфером и ламбертовым затенением. Это не
 * замена настоящему рендеру в сцене — материалы, отражения и HDRI здесь
 * не воспроизводятся. Задача узкая: увидеть форму и силуэт.
 *
 * Запуск: node scripts/preview.mjs public/models/case.glb out.png [--angle=35]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const [, , input, output = 'preview.png', ...rest] = process.argv
if (!input) {
  console.error('Использование: node scripts/preview.mjs <модель.glb> [out.png]')
  process.exit(1)
}

const arg = (name, fallback) => {
  const hit = rest.find((r) => r.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : fallback
}

const WIDTH = arg('w', 760)
const HEIGHT = arg('h', 560)
/** Поворот вокруг вертикали и подъём камеры, градусы */
const YAW = (arg('yaw', 28) * Math.PI) / 180
const PITCH = (arg('pitch', 26) * Math.PI) / 180
/** Поворот модели вокруг X — монета лежит в XY, футляр стоит в XZ */
const TILT = (arg('tilt', 0) * Math.PI) / 180

function loadGLB(path) {
  const buf = readFileSync(path)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Promise((ok, fail) =>
    new GLTFLoader().parse(ab, '', (g) => ok(g.scene), fail),
  )
}

/** Собираем все треугольники сцены в мировых координатах */
function collectTriangles(root) {
  const tris = []
  root.updateMatrixWorld(true)

  root.traverse((o) => {
    if (!o.isMesh) return
    const geo = o.geometry
    const pos = geo.attributes.position
    const idx = geo.index
    const count = idx ? idx.count : pos.count

    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    const color = mat?.color ? [mat.color.r, mat.color.g, mat.color.b] : [0.8, 0.8, 0.8]
    const rough = mat?.roughness ?? 0.6

    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()

    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i
      const i1 = idx ? idx.getX(i + 1) : i + 1
      const i2 = idx ? idx.getX(i + 2) : i + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld)
      tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), color, rough })
    }
  })

  return tris
}

function render(tris, box) {
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)
  const radius = size.length() / 2

  const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, 0.01, 100)
  const dist = radius / Math.tan((camera.fov * Math.PI) / 360) / 0.78
  camera.position.set(
    center.x + Math.sin(YAW) * Math.cos(PITCH) * dist,
    center.y + Math.sin(PITCH) * dist,
    center.z + Math.cos(YAW) * Math.cos(PITCH) * dist,
  )
  camera.lookAt(center)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()

  const vp = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  )

  const px = new Float32Array(WIDTH * HEIGHT * 3)
  const depth = new Float32Array(WIDTH * HEIGHT).fill(Infinity)
  // Фон — светло-серый, как на референс-рендерах
  px.fill(0.9)

  const key = new THREE.Vector3(0.45, 0.8, 0.5).normalize()
  const fill = new THREE.Vector3(-0.6, 0.15, 0.4).normalize()

  const project = (v) => {
    const p = v.clone().applyMatrix4(vp)
    return {
      x: (p.x * 0.5 + 0.5) * WIDTH,
      y: (1 - (p.y * 0.5 + 0.5)) * HEIGHT,
      z: p.z,
    }
  }

  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (const t of tris) {
    ab.subVectors(t.b, t.a)
    ac.subVectors(t.c, t.a)
    n.crossVectors(ab, ac)
    if (n.lengthSq() === 0) continue
    n.normalize()

    const A = project(t.a)
    const B = project(t.b)
    const C = project(t.c)

    const area = (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)
    if (area === 0) continue

    // Освещение двустороннее: нормали в generated-геометрии могут смотреть внутрь
    const lambert = Math.abs(n.dot(key))
    const back = Math.abs(n.dot(fill))
    const shade = 0.22 + 0.68 * lambert + 0.22 * back * (1 - t.rough * 0.5)

    const minX = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)))
    const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(A.x, B.x, C.x)))
    const minY = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)))
    const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(A.y, B.y, C.y)))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cx = x + 0.5
        const cy = y + 0.5
        const w0 = ((B.x - A.x) * (cy - A.y) - (cx - A.x) * (B.y - A.y)) / area
        const w1 = ((cx - A.x) * (C.y - A.y) - (C.x - A.x) * (cy - A.y)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue

        const z = w2 * A.z + w1 * B.z + w0 * C.z
        const o = y * WIDTH + x
        if (z >= depth[o]) continue
        depth[o] = z

        px[o * 3] = Math.min(1, t.color[0] * shade)
        px[o * 3 + 1] = Math.min(1, t.color[1] * shade)
        px[o * 3 + 2] = Math.min(1, t.color[2] * shade)
      }
    }
  }

  return px
}

/** Минимальный кодировщик PNG: IHDR + IDAT + IEND */
function encodePNG(px, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  let p = 0
  for (let y = 0; y < h; y++) {
    raw[p++] = 0 // фильтр строки: none
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3
      // Гамма-коррекция, иначе картинка выходит темнее ожидаемого
      for (let c = 0; c < 3; c++) {
        raw[p++] = Math.round(Math.pow(Math.max(0, Math.min(1, px[o + c])), 1 / 2.2) * 255)
      }
    }
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 2 // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const scene = await loadGLB(input)
if (TILT) scene.rotation.x = TILT

/*
 * --open=<градусы> открывает крышку. Это и есть проверка того, что начало
 * координат узла lid лежит на оси петли: если бы оно было в центре крышки,
 * она бы не откинулась, а провалилась внутрь корпуса.
 */
const OPEN = arg('open', 0)
if (OPEN) {
  const lid = scene.getObjectByName('lid')
  if (lid) lid.rotation.x = (-OPEN * Math.PI) / 180
  else console.warn('Узел lid не найден — открывать нечего')
}

scene.updateMatrixWorld(true)

const tris = collectTriangles(scene)
const box = new THREE.Box3().setFromObject(scene)
const px = render(tris, box)
writeFileSync(output, encodePNG(px, WIDTH, HEIGHT))

console.log(`${output} — ${tris.length.toLocaleString('ru')} треугольников`)
