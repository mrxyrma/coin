import { CoinAnchor } from '../ui/CoinAnchor'

/** Выноска: линия от текста к точке на монете (десктоп) */
function Leader({ variant }: { variant: 'relief' | 'guilloche' }) {
  return (
    <div className={`leader leader--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 205 72" preserveAspectRatio="none">
        <path
          d={variant === 'relief' ? 'M205 0 L12 57' : 'M0 57 L193 0'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx={variant === 'relief' ? 11 : 194}
          cy={variant === 'relief' ? 61 : 61}
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
