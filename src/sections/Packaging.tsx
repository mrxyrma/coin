import { CoinAnchor } from '../ui/CoinAnchor'

/** Секция «упаковка»: акриловый футляр «Конструктор» */
export function Packaging() {
  return (
    <section className="section packaging" id="packaging">
      <div className="packaging__text">
        <h2>
          Как упакована
          <br />
          монета?
        </h2>
        <p>
          Акриловый футляр «Конструктор» выполнен из трёх пластин матового
          акрила, скреплённых неодимовыми магнитами. В центральной пластине —
          углубление под монету с точностью до 0,1 мм.
        </p>
      </div>

      <div className="packaging__case packaging__case--acrylic">
        {/* Заменяется на 3D-футляр после получения модели (этап 5) */}
        <div className="case-placeholder" />
        {/* Углубление под монету в центральной пластине */}
        <CoinAnchor id="case-acrylic" />
      </div>
    </section>
  )
}
