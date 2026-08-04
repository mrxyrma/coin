import { CoinAnchor } from '../ui/CoinAnchor'
import { flipCoin, setMetal, useMetal, useSide } from '../lib/coinStore'

const METALS = [
  { id: 'gold', label: 'Золото' },
  { id: 'silver', label: 'Серебро' },
] as const

const SIDES = {
  obverse: {
    title: 'Аверс',
    text: 'Пеликан, кормящий птенцов. Эта птица в геральдике олицетворяет жертвенность, милосердие и опеку — качества, заложенные в основе миссии первых сберкасс. Такое же изображение было и на первых сберегательных книжках.',
  },
  reverse: {
    title: 'Реверс',
    // TODO: текста реверса в макете нет — запросить у заказчика
    text: 'Описание реверса появится после согласования текста.',
  },
} as const

export function Appearance() {
  const metal = useMetal()
  const side = useSide()

  return (
    <section className="section appearance" id="appearance">
      <div className="appearance__head">
        <h2>Как она выглядит?</h2>
        <p>
          Две стороны одной монеты создают смысловой мост между прошлым и
          настоящим, показывают, что ценности заботы и развития всегда актуальны
          для Сбера.
        </p>

        <div className="tabs" role="tablist" aria-label="Металл монеты">
          {METALS.map((m) => (
            <button
              key={m.id}
              className="tabs__item"
              role="tab"
              type="button"
              aria-selected={metal === m.id}
              onClick={() => setMetal(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="appearance__body">
        <div className="appearance__stage">
          <CoinAnchor id="appearance" />
          {/*
            Canvas не принимает события (pointer-events: none), поэтому
            переворот вешаем на настоящую кнопку поверх якоря — заодно
            механика доступна с клавиатуры.
          */}
          <button
            type="button"
            className="coin-flip"
            onClick={flipCoin}
            aria-label={`Перевернуть монету, сейчас ${SIDES[side].title.toLowerCase()}`}
          />
        </div>

        <div className="appearance__side">
          <h3>{SIDES[side].title}</h3>
          <p>{SIDES[side].text}</p>
        </div>
      </div>
    </section>
  )
}
