/**
 * Конвейер подготовки монеты от дизайнера к вебу.
 *
 * На вход приходит исходник из Blender: ~95 МБ, 1.5 млн треугольников,
 * три PNG 4096×4096. На выход — модель, которую не стыдно отдать телефону.
 *
 *   node scripts/optimize-coin.mjs public/models/moneta_aist.glb public/models/coin-obverse.glb
 *
 * Что делается и почему:
 *
 * 1. Трансформ ноды запекается в вершины. Blender экспортирует поворот
 *    +90° по X (перевод Z-up → Y-up) как свойство ноды. Приложение считает
 *    монету плоской в XY с толщиной по Z, и лишний поворот в иерархии
 *    ломал бы всю математику траектории.
 *
 * 2. Геометрия нормализуется: центр в начало координат, диаметр ровно 1.
 *    Коду достаточно знать MODEL_DIAMETER = 1 и не думать о том, в каких
 *    единицах работал дизайнер.
 *
 * 3. Децимация. Рельеф пеликана — настоящая геометрия, но 1.5 млн
 *    треугольников не нужны: монета на экране максимум 360 CSS-пикселей.
 *    Мелкую фактуру держит карта нормалей, силуэт рельефа — геометрия.
 *
 * 4. Текстуры ужимаются и переводятся в WebP. Размеры разные осознанно:
 *    карта нормалей несёт гильош и тончайшие линии, ей нужно разрешение;
 *    цвет и металличность у монеты почти однородны и переживают ужатие.
 */
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { basename } from 'node:path'

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  clearNodeTransform,
  dedup,
  getBounds,
  join,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const [input, output, ratioArg] = process.argv.slice(2)
if (!input || !output) {
  console.error(
    'Использование: node scripts/optimize-coin.mjs <вход.glb> <выход.glb> [доля_треугольников]',
  )
  process.exit(1)
}

/*
 * Доля треугольников, которую оставляем: 1.5 млн × 0.03 → ~45 тыс.
 *
 * Порог подобран сравнением рендеров, а не на глаз: 150 тыс. и 45 тыс.
 * при четырёх ракурсах (анфас, 3/4, вскользь, ребро) неразличимы, а
 * 45 тыс. дешевле на 0.8 МБ. Ниже опускаться бессмысленно — там начинает
 * работать ограничение ERROR и децимация всё равно упирается в ~42 тыс.
 */
const RATIO = ratioArg ? Number(ratioArg) : 0.03
/** Допустимое отклонение силуэта при децимации, доля от габарита. */
const ERROR = 0.001

/**
 * Размеры карт. Монета занимает на экране не больше 360 CSS-пикселей,
 * то есть ~720 физических при dpr 2 — 4096 избыточно втрое даже для нормали.
 */
const TEXTURES = [
  { slots: /normalTexture/, size: 2048, quality: 95, note: 'нормали: гильош и мелкая фактура' },
  { slots: /baseColorTexture/, size: 1024, quality: 90, note: 'цвет: почти однородное золото' },
  { slots: /metallicRoughnessTexture/, size: 1024, quality: 90, note: 'металличность и шероховатость' },
]

const mb = (n) => (n / 1048576).toFixed(2) + ' МБ'

// Кодировщик meshopt нужен не только трансформации, но и самой записи GLB:
// упаковку буферов делает расширение в момент io.write().
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
})
const doc = await io.read(input)
const root = doc.getRoot()

// --- 1. Запекаем трансформы нод в вершины -------------------------------
for (const node of root.listNodes()) {
  if (node.getMesh()) clearNodeTransform(node)
}

const trisBefore = countTris(doc)

// --- 2. Чистка, сварка, децимация ---------------------------------------
await MeshoptSimplifier.ready
await doc.transform(
  dedup(),
  join(),
  // Децимация работает только по сваренной сетке: несваренные дубли вершин
  // на швах развёртки алгоритм считает разрывами и не схлопывает.
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }),
  prune(),
)

const trisAfter = countTris(doc)

// --- 3. Нормализация: центр в 0, диаметр 1 ------------------------------
const { min, max } = meshBounds(doc)
const center = min.map((v, i) => (v + max[i]) / 2)
// Диаметр — наибольшая из двух поперечных осей, толщину не трогаем
const diameter = Math.max(max[0] - min[0], max[1] - min[1])
const scale = 1 / diameter

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const el = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el)
      pos.setElement(i, [
        (el[0] - center[0]) * scale,
        (el[1] - center[1]) * scale,
        (el[2] - center[2]) * scale,
      ])
    }
  }
}

// --- 4. Текстуры ---------------------------------------------------------
for (const t of TEXTURES) {
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      slots: t.slots,
      resize: [t.size, t.size],
      quality: t.quality,
    }),
  )
}

/*
 * 5. Сжатие геометрии (EXT_meshopt_compression).
 *
 * Идёт последним: квантование и упаковка меняют буферы, и любая
 * трансформация после них распаковала бы результат обратно.
 * Выбран meshopt, а не DRACO: декодер — это несколько килобайт JS,
 * который уезжает в общий бандл, тогда как DRACO требует тянуть wasm
 * отдельным файлом (по умолчанию вообще с CDN — лишняя точка отказа).
 */
await MeshoptEncoder.ready
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }))

await io.write(output, doc)

// --- Отчёт ---------------------------------------------------------------
const before = statSync(input).size
const after = statSync(output).size
const gz = gzipSync(readFileSync(output)).length
/*
 * Габарит меряем по сцене, а не по сырым аксессорам: квантование meshopt
 * растягивает координаты вершин на весь диапазон и компенсирует это
 * масштабом на ноде. По сырым данным диаметр читался бы как 2.
 */
const bounds = getBounds(root.listScenes()[0])

console.log(`\n${basename(input)} → ${basename(output)}`)
console.log(`  вес:         ${mb(before)} → ${mb(after)} (gzip ${mb(gz)})`)
console.log(
  `  треугольники: ${trisBefore.toLocaleString('ru')} → ${trisAfter.toLocaleString('ru')}`,
)
console.log(
  '  габарит:     ' +
    bounds.max.map((v, i) => (v - bounds.min[i]).toFixed(4)).join(' × '),
)
console.log(
  '  центр:       ' +
    bounds.max.map((v, i) => ((v + bounds.min[i]) / 2).toFixed(4)).join(', '),
)
console.log('  текстуры:')
for (const tex of root.listTextures()) {
  const img = tex.getImage()
  const size = tex.getSize()
  console.log(
    `    ${tex.getName() || '(без имени)'}: ${size?.join('×')} ${tex.getMimeType()} ${mb(img.byteLength)}`,
  )
}

function countTris(document) {
  let n = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      n += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3
    }
  }
  return Math.round(n)
}

function meshBounds(document) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const el = [0, 0, 0]
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el)
        for (let k = 0; k < 3; k++) {
          if (el[k] < min[k]) min[k] = el[k]
          if (el[k] > max[k]) max[k] = el[k]
        }
      }
    }
  }
  return { min, max }
}
