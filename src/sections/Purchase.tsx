import { CoinAnchor } from '../ui/CoinAnchor'

export function Purchase() {
  return (
    <section className="section purchase" id="purchase">
      <CoinAnchor id="purchase" />

      <div className="purchase__text">
        <h2>
          Эксклюзивно
          <br />в офисах Сбера
        </h2>
        <p>
          Приобрести монету можно только в офисах Сбера. Выберите удобный из
          списка
        </p>
        <a className="btn btn--light" href="#offices">
          Выбрать офис
        </a>
      </div>
    </section>
  )
}
