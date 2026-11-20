module.exports = {
  theme: {
    colors: {
      paper: "#ffffff",
    },
    extend: {
      colors: {
        ink: "#111111",
        success: "#2e7d32",
        error: "#d32f2f",
        danger: theme("colors.red.500"),
        primary: {
          DEFAULT: "#111111",
          foreground: "#ffffff",
        },
      },
    },
  },
};
