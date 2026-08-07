import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

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
  build: {
    rollupOptions: {
      /*
       * Две страницы: основная и копия с монетой на карте нормалей —
       * их сравнивают в двух вкладках. На Pages нет серверного роутинга,
       * поэтому вариант обязан быть настоящим HTML, а не параметром в URL.
       */
      input: {
        main: page('index.html'),
        normalmap: page('with-normal-map/index.html'),
      },
    },
  },
  server: {
    // Слушаем все интерфейсы, чтобы открывать с телефона по адресу
    // вида http://192.168.x.x:5173 — проверять анимацию на реальном
    // мобильном GPU обязательно, эмуляция в DevTools этого не показывает
    host: true,
  },
})
