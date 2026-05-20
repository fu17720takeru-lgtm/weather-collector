import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind が適用されるファイルの範囲を指定
  // src/ 以下の .ts .tsx .js .jsx ファイルにスタイルが使われる
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
