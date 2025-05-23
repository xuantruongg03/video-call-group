import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    // https: {
    //   key: fs.readFileSync("secrets/private-key.pem"),
    //   cert: fs.readFileSync("secrets/public-certificate.pem"),
    // },
    // allowedHosts: [
    //   "8fb0-42-1-85-88.ngrok-free.app", 
    //   "localhost", 
    // ],
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
