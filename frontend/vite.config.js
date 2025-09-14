import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from the project root
  const env = loadEnv(mode, process.cwd() + '/../', '')
  
  return {
    plugins: [react()],
    
    // Map existing environment variables to VITE_ prefixed ones
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.BACKEND_URL || 'http://localhost:8000'),
    },
    
    // Load .env files from the project root (parent directory)
    envDir: '../',
    
    server: {
      host: true, // Listen on all interfaces (0.0.0.0)
      port: 5173, // Or your preferred port
      allowedHosts: ["sandbox-unvt01.0x10f2c.com"],
    },
  }
})
