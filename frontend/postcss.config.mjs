import path from "path";
import { fileURLToPath } from "url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    tailwindcss: {
      config: path.join(frontendRoot, "tailwind.config.ts"),
    },
    autoprefixer: {},
  },
};

export default config;
