import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // 0.0.0.0 — сервер виден телефону в том же Wi-Fi по IP компа.
    // Сокет HMR идёт на тот же хост, что в адресной строке (без оверрайда):
    // на ПК открывай 127.0.0.1:5173, на телефоне — IP_компа:5173.
    host: '0.0.0.0',
    port: 5173,
    open: true
  }
})
