import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this app at:
// https://<your-username>.github.io/teacher-dashboard/
// Dev uses `/` so http://localhost:5173/ works without the repo path.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/teacher-dashboard/' : '/',
}))
