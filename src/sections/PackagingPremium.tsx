import { CoinAnchor } from '../ui/CoinAnchor'

/** Секция «упаковка 2»: буковый футляр — сюда монета укладывается в финале */
export function PackagingPremium() {
  return (
    <section className="section packaging" id="packaging-premium">
      <div className="packaging__text">
        <h2>
          Как упакована
          <br />
          монета?
        </h2>
        <p>
          Премиальный набор в ограниченном количестве. Футляр из бука с
          серебряным тиснением и магнитным замком. Внутри ложемент с
          индивидуальной вырубкой и выдвижной ярус для перчаток и лупы,
          превращающий распаковку в церемонию.
        </p>
      </div>

      <div className="packaging__case packaging__case--premium">
        {/* Якорь всего футляра: 3D-модель встаёт по нему */}
        <CoinAnchor id="case-shell" className="case-shell" />
        {/* Якорь в ложементе: соотношение 206×144 задаёт ракурс укладки ≈45.6° */}
        <CoinAnchor id="case" />
      </div>
    </section>
  )
}
