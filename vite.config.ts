import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Слушаем все интерфейсы, чтобы открывать с телефона по адресу
    // вида http://192.168.x.x:5173 — проверять анимацию на реальном
    // мобильном GPU обязательно, эмуляция в DevTools этого не показывает
    host: true,
  },
})
