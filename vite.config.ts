import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  /*
   * GitHub Pages отдаёт проект по адресу вида user.github.io/<repo>/,
   * поэтому все ссылки на ассеты должны быть с этим префиксом. Имя репозитория
   * не зашиваем: его подставляет workflow через BASE_PATH. Локально и при
   * деплое на собственный домен переменной нет — база остаётся корнем.
   */
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    // Слушаем все интерфейсы, чтобы открывать с телефона по адресу
    // вида http://192.168.x.x:5173 — проверять анимацию на реальном
    // мобильном GPU обязательно, эмуляция в DevTools этого не показывает
    host: true,
  },
})
