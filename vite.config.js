import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // IPv4 явно: Firefox резолвит localhost в ::1, а сервер на 127.0.0.1 —
    // из-за этого падал WebSocket HMR. host+h mr.host держат всё на IPv4.
    host: '127.0.0.1',
    port: 5173,
    open: true,
    hmr: {
      host: '127.0.0.1'
    }
  }
})
