/**
 * Заглушка фирменного знака.
 *
 * Официальный логотип Сбера — лицензионный ассет: положить SVG в
 * public/brand/sber-logo.svg и заменить содержимое на <img>/inline-SVG.
 * Размеры соответствуют макету: 217×34 в меню, 401×63 в подвале.
 */
export function SberLogo({ height = 34 }: { height?: number }) {
  return (
    <span
      className="sber-logo"
      style={{
        display: 'inline-block',
        height,
        aspectRatio: '124 / 34',
        background: 'var(--c-surface)',
        borderRadius: 4,
      }}
      role="img"
      aria-label="Сбер"
    />
  )
}
