// vite.config.js
import glsl from "vite-plugin-glsl"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [glsl(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
})
