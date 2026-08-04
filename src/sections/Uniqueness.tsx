import { CoinAnchor } from '../ui/CoinAnchor'

/**
 * Выноска: линия от текстового блока к точке на монете.
 *
 * Кружок всегда на том конце, который лежит на монете, а линия уходит
 * в сторону своего текста: у «рельефа» текст справа, у «гильоширования»
 * слева, поэтому линии зеркальны.
 */
function Leader({ variant }: { variant: 'relief' | 'guilloche' }) {
  const toCoin = variant === 'relief'
  return (
    <div className={`leader leader--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 205 72" preserveAspectRatio="none">
        <path
          d={toCoin ? 'M205 0 L12 57' : 'M0 0 L193 57'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx={toCoin ? 11 : 194}
          cy="61"
          r="11"
          fill="var(--c-bg)"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    </div>
  )
}

export function Uniqueness() {
  return (
    <section className="section unique" id="unique">
      <div className="unique__head">
        <h2>В чём уникальность?</h2>
        <p>При создании монет мы использовали две редкие технологии</p>
      </div>

      <div className="unique__stage">
        <CoinAnchor id="unique" />

        <div className="unique__dots" aria-hidden="true">
          <span className="unique__dot unique__dot--relief" />
          <span className="unique__dot unique__dot--guilloche" />
        </div>

        <Leader variant="relief" />
        <Leader variant="guilloche" />

        <article className="callout callout--relief">
          <h4>Технология высокого рельефа</h4>
          <p>
            Многоуровневый эффект для изображения пеликана мы достигли с помощью
            технологии высокого рельефа (Ultra High Relief). Фигура птицы
            значительно выступает над поверхностью и приобретает скульптурную
            объёмность. Пеликан словно «вылетает» из временного потока и
            становится осязаемым символом истории.
          </p>
        </article>

        <article className="callout callout--guilloche">
          <h4>Гильоширование</h4>
          <p>
            Техника нанесения сложного геометрического орнамента из тончайших
            перекрёстных линий на металл с помощью специального гравировального
            станка. Так мы создали «живую» игру света, когда мерцающий фон
            изменяется при малейшем повороте монеты. Луч времени прочерчивает
            путь по поверхности металла, оставляет на нём волны, лучи и
            концентрические круги.
          </p>
        </article>
      </div>
    </section>
  )
}
