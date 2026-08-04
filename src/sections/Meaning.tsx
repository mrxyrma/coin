import { CoinAnchor } from '../ui/CoinAnchor'

export function Meaning() {
  return (
    <section className="section meaning" id="meaning">
      <div className="meaning__text">
        <h2>
          Какой смысл
          <br />
          мы заложили?
        </h2>
        <p>
          Луч исходит из 1841 года — точки отсчёта, когда в Санкт-Петербурге
          открылась первая сберегательная касса. С тех пор мы несём свет заботы,
          надёжности и милосердия через каждую эпоху. Сегодня этот луч
          преломился в архитектуре нашей штаб-квартиры, в технологиях и в каждом
          решении, меняющем жизнь людей.
        </p>
        <a className="btn" href="#history">
          Подробнее об истории
        </a>
      </div>

      <CoinAnchor id="meaning" />
    </section>
  )
}
