import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this app at:
// https://<your-username>.github.io/teacher-dashboard/
// If you rename the repo, change `base` to match: '/your-repo-name/'
export default defineConfig({
  plugins: [react()],
  base: '/teacher-dashboard/',
})
