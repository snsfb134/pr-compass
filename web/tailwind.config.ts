const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f6f4ee",
        panel: "#fffdf8",
        ink: "#1c2530",
        muted: "#5f6c79",
        line: "#d8d1bf",
        primary: "#c3a44a",
        "primary-strong": "#8b6a1e",
        "primary-soft": "#fae8bf",
        accent: "#c3a44a",
      },
      boxShadow: {
        soft: "0 18px 54px rgba(63, 48, 16, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
