import { Menu } from '../ui/Menu'
import { CoinAnchor } from '../ui/CoinAnchor'

export function Hero() {
  return (
    <section className="section section--bleed hero" id="hero">
      <Menu />

      {/* В макете две монеты, вторая перекрывает первую: золото и серебро */}
      <div className="hero__coins">
        <CoinAnchor id="hero-gold" />
        <CoinAnchor id="hero-silver" />
      </div>

      <div className="hero__title">
        <h1>Монеты «Сбербанк-185»: вечные ценности</h1>
        <p className="hero__lead">
          К 185 летию Сбер выпустил коллекционные монеты из золота
          <br />и серебра. В основе концепции — «Луч времени», он освещает наш
          путь, соединяет прошлое, настоящее и будущее.
        </p>
      </div>
    </section>
  )
}
