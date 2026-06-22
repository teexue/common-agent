import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import path from "path"

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "CommonAgentSDK",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [],
    },
    sourcemap: true,
  },
})
