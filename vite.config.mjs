import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const processEnvValues = {
    "process.env.NODE_ENV": JSON.stringify(
      mode === "production" ? "production" : "development"
    ),
    global: "globalThis",
  };

  Object.keys(env).forEach((key) => {
    if (key.startsWith("REACT_APP_") || key.startsWith("VITE_")) {
      processEnvValues[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  });

  return {
    plugins: [react()],
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    envPrefix: ["VITE_", "REACT_APP_"],
    define: processEnvValues,
    server: {
      port: 3000,
      open: false,
    },
    build: {
      outDir: "build",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (
              id.includes("/firebase/") ||
              id.includes("/@firebase/") ||
              id.includes("\\firebase\\") ||
              id.includes("\\@firebase\\")
            ) {
              return "vendor-firebase";
            }
            if (
              id.includes("/xlsx/") ||
              id.includes("\\xlsx\\")
            ) {
              return "vendor-xlsx";
            }
            if (
              id.includes("/recharts/") ||
              id.includes("\\recharts\\") ||
              id.includes("/d3-") ||
              id.includes("\\d3-") ||
              id.includes("/victory-vendor/") ||
              id.includes("\\victory-vendor\\")
            ) {
              return "vendor-charts";
            }
            if (
              id.includes("/html2canvas/") ||
              id.includes("\\html2canvas\\")
            ) {
              return "vendor-html2canvas";
            }
            if (
              id.includes("/gsap/") ||
              id.includes("\\gsap\\")
            ) {
              return "vendor-gsap";
            }
            return undefined;
          },
        },
      },
    },
  };
});
