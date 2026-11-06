import { defineConfig, type Plugin } from 'vite'
import { installFilesystemMiddleware } from './node/http-workspace-bridge'

const localFilesystemBridge = (): Plugin => ({
  name: 'office-md-local-filesystem',
  configureServer: (server) => installFilesystemMiddleware(server.middlewares),
  configurePreviewServer: (server) => installFilesystemMiddleware(server.middlewares),
})

export default defineConfig({
  base: './',
  plugins: [localFilesystemBridge()],
})
