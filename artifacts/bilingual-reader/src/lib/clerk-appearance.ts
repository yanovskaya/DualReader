export const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(353, 50%, 29%)",
    colorBackground: "hsl(42, 33%, 98%)",
    colorText: "hsl(30, 4%, 17%)",
    colorTextSecondary: "hsl(30, 4%, 45%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorInputText: "hsl(30, 4%, 17%)",
    colorNeutral: "hsl(30, 4%, 17%)",
    borderRadius: "0.3rem",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    card: {
      boxShadow: "0 1px 4px rgba(107, 30, 46, 0.06), 0 0 0 1px rgba(107, 30, 46, 0.08)",
      border: "1px solid hsl(36, 20%, 86%)",
      background: "hsl(0, 0%, 100%)",
    },
    formButtonPrimary: {
      backgroundColor: "hsl(353, 50%, 29%)",
    },
    footerActionLink: {
      color: "hsl(353, 50%, 29%)",
    },
  },
} as const;
