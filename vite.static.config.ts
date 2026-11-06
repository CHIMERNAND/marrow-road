import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "C:/Users/accla/.gemini/antigravity/scratch/marrow-road",
  base: "./",
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [tailwindcss(), viteReact()],
});
