/**
 * Какой вариант модели монеты показывает текущая страница.
 *
 * Дизайнер предложил заменить настоящий геометрический рельеф плоской плашкой
 * с картой нормалей — это заметно легче по весу. Решать такое по статичным
 * рендерам бессмысленно: рельеф проявляет себя в движении, на скользящих
 * ракурсах пролёта. Поэтому собраны две копии лендинга, различающиеся ровно
 * одним — моделью монеты, и их сравнивают в двух вкладках.
 *
 * Вариант берётся из атрибута на <html>, а не из URL: на GitHub Pages нет
 * серверного роутинга, страницы — отдельные HTML, и атрибут в разметке
 * избавляет от второй точки входа в TypeScript.
 */
export type CoinVariant = 'geometry' | 'normalmap'

export const VARIANTS: Record<CoinVariant, { title: string; model: string; other: string }> = {
  geometry: {
    title: 'Рельеф геометрией',
    model: 'coin-obverse.glb',
    other: 'with-normal-map/',
  },
  normalmap: {
    title: 'Рельеф картой нормалей',
    model: 'coin-normalmap.glb',
    other: '../',
  },
}

export const coinVariant: CoinVariant =
  document.documentElement.dataset.coinVariant === 'normalmap' ? 'normalmap' : 'geometry'

export const variantConfig = VARIANTS[coinVariant]
