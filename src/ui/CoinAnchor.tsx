/**
 * Невидимый якорь монеты.
 *
 * Занимает в потоке ровно то место, где монета стоит в макете. Раскладку
 * задаёт CSS секции — 3D-сцена лишь читает getBoundingClientRect() всех
 * якорей и переводит пиксели в мировые координаты. Благодаря этому
 * траектория адаптируется к любой ширине экрана без цифр в JS.
 *
 * Параметры движения (наклон, обороты, вынос дуги) лежат отдельно,
 * в src/lib/trajectory.ts, и связываются с якорем по id.
 */
export function CoinAnchor({ id, className }: { id: string; className?: string }) {
  return (
    <div
      className={className ? `coin-anchor ${className}` : 'coin-anchor'}
      data-coin-anchor={id}
      aria-hidden="true"
    />
  )
}
