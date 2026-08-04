import { SberLogo } from '../ui/SberLogo'

export function Footer() {
  return (
    <footer className="section footer">
      <div className="footer__brand">
        <SberLogo height={63} />
        <span className="menu__divider" aria-hidden="true" />
        <span className="menu__years">185</span>
      </div>

      <p className="footer__license">
        Генеральная лицензия на осуществление банковских операций от 11 августа
        2015 года. Регистрационный номер — 1481
      </p>

      <div className="footer__bottom">
        <span>© 1997—2026 ПАО Сбербанк. sberbank.ru</span>
        <span>Контакт для связи startupsummit@sberbank.ru</span>
        <a href="#privacy">Политика обработки персональных данных</a>
      </div>
    </footer>
  )
}
