import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    build: {
        emptyOutDir: true,
        outDir: "dist",
        rollupOptions: {
            input: "quest-script.html",
        },
    },
});
