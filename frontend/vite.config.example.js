import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],

    // Define the backend URL at build time, make sure to update this when deploying
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://localhost:7618'),
    },
  }
})
