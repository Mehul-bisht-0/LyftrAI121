import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      colors: {
        relay: {
          bg:        "hsl(var(--bg))",
          surface:   "hsl(var(--surface))",
          elevated:  "hsl(var(--elevated))",
          hover:     "hsl(var(--hover))",
          border:    "hsl(var(--border))",
          "border-hi": "hsl(var(--border-hi))",
          text:      "hsl(var(--text))",
          muted:     "hsl(var(--text-muted))",
          dim:       "hsl(var(--text-dim))",
          accent:    "hsl(var(--accent))",
          "accent-hi":  "hsl(var(--accent-hi))",
          "accent-bg":  "hsl(var(--accent-bg))",
          success:   "hsl(var(--success))",
          warn:      "hsl(var(--warn))",
          error:     "hsl(var(--error))",
        },
        /* legacy compat */
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        background: "hsl(var(--bg))",
        foreground: "hsl(var(--text))",
        primary: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--text-muted))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--text))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "glow-accent": "0 0 20px hsl(var(--accent) / 0.15), 0 0 40px hsl(var(--accent) / 0.08)",
        "glow-sm": "0 0 12px hsl(var(--accent) / 0.2)",
        "surface": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "elevated": "0 4px 16px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
