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
/** Ниже этого числа треугольников децимация не запускается. */
const TRIS_BUDGET = 80_000

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
/*
 * Децимация нужна не всегда. Первая посылка приехала с 1.5 млн треугольников,
 * а вариант с картой нормалей — с 9 тысячами: там прореживать нечего, и
 * запуск simplify только испортил бы и без того экономную сетку.
 */
const needsSimplify = trisBefore > TRIS_BUDGET

await MeshoptSimplifier.ready
await doc.transform(
  dedup(),
  join(),
  // Децимация работает только по сваренной сетке: несваренные дубли вершин
  // на швах развёртки алгоритм считает разрывами и не схлопывает.
  ...(needsSimplify
    ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR })]
    : []),
  prune(),
)

const trisAfter = countTris(doc)

// --- 3. Нормализация: ориентация, центр в 0, диаметр 1 ------------------
/*
 * Разные выгрузки кладут монету по-разному: первая посылка приехала толщиной
 * по Z, вариант с картой нормалей — по X. Приложение же считает монету
 * плоской в XY с толщиной по Z и строит на этом всю математику траектории.
 * Поэтому тонкую ось ищем по габариту и доворачиваем в Z, а не полагаемся
 * на то, как её положил конкретный экспорт.
 */
const thin = thinAxis(meshBounds(doc))
if (thin !== 2) rotateThinAxisToZ(doc, thin)

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

/*
 * 3a. Декорированная сторона — к зрителю.
 *
 * Приложение показывает монету лицом в +Z при нулевом повороте. Куда смотрит
 * рельеф в исходнике, зависит от того, как дизайнер положил модель: у варианта
 * с картой нормалей плашка лежала на −X и после доворота тонкой оси уехала
 * на −Z, то есть на изнанку — на сайте была видна гладкая болванка.
 *
 * Ориентируемся по плоской плашке: если она смотрит назад, переворачиваем
 * модель. У модели с геометрическим рельефом плашки нет, и шаг не срабатывает.
 */
const plate = flatPlate(doc)
if (plate && plate.z < 0) {
  flipAboutY(doc)
  console.log('  декорированная сторона развёрнута к зрителю')
}

/*
 * 3b. Развод компланарных плашек.
 *
 * В варианте с картой нормалей рельеф — отдельная плоская плашка, и в черновой
 * выгрузке она лежит ровно в плоскости дна углубления болванки (обе на
 * x = −0.01406). Два совпадающих полигона в одном месте дают z-fighting:
 * при повороте по ним идёт рябь из чередующихся пикселей.
 *
 * Отодвигаем плашку наружу на 1% толщины монеты. На экране это 0.16 пикселя
 * при диаметре 360 — не видно, а глубины разводит гарантированно.
 * Дизайнеру про это сказано отдельно: в исходнике смещение лучше заложить.
 */
const thickness = (() => {
  const b = meshBounds(doc)
  return b.max[2] - b.min[2]
})()

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const zs = { lo: Infinity, hi: -Infinity }
    const el = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el)
      if (el[2] < zs.lo) zs.lo = el[2]
      if (el[2] > zs.hi) zs.hi = el[2]
    }
    // Плоская плашка — это примитив без собственной толщины
    if (zs.hi - zs.lo > thickness * 0.01) continue

    // Наружу — в ту сторону, где плашка и так лежит относительно центра
    const shift = Math.sign(zs.lo || 1) * thickness * 0.01
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el)
      pos.setElement(i, [el[0], el[1], el[2] + shift])
    }
    console.log(
      `  плашка «${prim.getMaterial()?.getName()}» отодвинута на ${shift.toFixed(5)} от дна углубления`,
    )
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

/**
 * Плоская плашка с рельефом, если она в модели есть.
 *
 * Признак — примитив без собственной толщины по Z: рельеф в варианте
 * с картой нормалей нарисован на одной плоскости. У модели с геометрическим
 * рельефом такого примитива нет, и функция вернёт null.
 */
function flatPlate(document) {
  const total = (() => {
    const b = meshBounds(document)
    return b.max[2] - b.min[2]
  })()

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      let lo = Infinity
      let hi = -Infinity
      const el = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el)
        if (el[2] < lo) lo = el[2]
        if (el[2] > hi) hi = el[2]
      }
      if (hi - lo <= total * 0.01) return { prim, z: (lo + hi) / 2 }
    }
  }
  return null
}

/** Разворот модели лицом назад: поворот на 180° вокруг Y. */
function flipAboutY(document) {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const name of ['POSITION', 'NORMAL', 'TANGENT']) {
        const attr = prim.getAttribute(name)
        if (!attr) continue
        const el = [0, 0, 0, 0]
        for (let i = 0; i < attr.getCount(); i++) {
          attr.getElement(i, el)
          const r = [-el[0], el[1], -el[2]]
          attr.setElement(i, attr.getElementSize() === 4 ? [...r, el[3]] : r)
        }
      }
    }
  }
}

/** Индекс самой тонкой оси габарита: у монеты это её толщина. */
function thinAxis({ min, max }) {
  const size = max.map((v, i) => v - min[i])
  return size.indexOf(Math.min(...size))
}

/**
 * Доворот модели так, чтобы тонкая ось встала в Z.
 *
 * Крутим сами координаты, а не ноду: трансформ ноды пришлось бы учитывать
 * во всех последующих шагах и в приложении, а так дальше по конвейеру
 * и в браузере модель уже лежит правильно.
 */
function rotateThinAxisToZ(document, axis) {
  // X → Z это поворот на −90° вокруг Y, Y → Z — на +90° вокруг X
  const map = axis === 0 ? (v) => [-v[2], v[1], v[0]] : (v) => [v[0], -v[2], v[1]]

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      // Нормали и касательные — такие же направления, их поворачиваем тем же
      // отображением: поворот ортогонален, масштаба в нём нет
      for (const name of ['POSITION', 'NORMAL', 'TANGENT']) {
        const attr = prim.getAttribute(name)
        if (!attr) continue
        const el = [0, 0, 0, 0]
        for (let i = 0; i < attr.getCount(); i++) {
          attr.getElement(i, el)
          const r = map(el)
          // У TANGENT четвёртая компонента — знак бинормали, её не трогаем
          attr.setElement(i, attr.getElementSize() === 4 ? [...r, el[3]] : r)
        }
      }
    }
  }
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
