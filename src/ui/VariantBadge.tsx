import { coinVariant, variantConfig, VARIANTS } from '../lib/coinVariant'

/**
 * Метка сравнения: какой вариант монеты сейчас на экране и ссылка на соседний.
 *
 * Нужна, пока идёт выбор между геометрическим рельефом и картой нормалей:
 * две вкладки выглядят одинаково, и без подписи легко перепутать, что
 * на скриншоте. Ссылка относительная — работает и локально, и в подкаталоге
 * GitHub Pages без знания базового пути.
 */
export function VariantBadge() {
  const other = coinVariant === 'geometry' ? VARIANTS.normalmap : VARIANTS.geometry

  return (
    <aside className="variant-badge">
      <b>{variantConfig.title}</b>
      <a href={variantConfig.other}>→ {other.title}</a>
    </aside>
  )
}
