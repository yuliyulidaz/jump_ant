import { defineConfig } from 'vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/jump_ant/' : '/',
  plugins: [aitDevtools.vite()],
})
