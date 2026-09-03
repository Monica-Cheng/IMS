import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens from CLAUDE.md
        background: "#EFF6FF",
        "background-alt": "#DBEAFE",
        sidebar: "#1E3A5F",
        "sidebar-dark": "#1E40AF",
        accent: "#0EA5E9",
      },
    },
  },
  plugins: [],
};

export default config;
