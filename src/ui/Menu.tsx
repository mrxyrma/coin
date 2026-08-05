import { SberLogo } from './SberLogo'

/** Плавающая шапка-пилюля из макета: лого · разделитель · 185 · РУС */
export function Menu() {
  return (
    <header className="menu">
      <a
        className="menu__brand"
        href={import.meta.env.BASE_URL}
        aria-label="Сбер, 185 лет"
      >
        <SberLogo />
        <span className="menu__divider" aria-hidden="true" />
        <span className="menu__years">185</span>
      </a>

      {/* Локализация не планируется — элемент статичный, как в макете */}
      <span className="menu__lang">
        РУС
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.5 5.75 8 10.25l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </header>
  )
}
