import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Mila RL Docs",
  description: "Mila Reinforcement Learning Documentation",
  lang: "en-US",
  lastUpdated: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: {
      light: "/mila-logo-light.svg",
      dark: "/mila-logo-dark.svg",
      alt: "Mila Logo",
    },
    nav: [{ text: "Datasets", link: "https://datasets.server.mila.quebec/" }],
    sidebar: [
      {
        text: "Workflows",
        items: [{ text: "PDM", link: "/workflows/pdm" }],
      },
      // Example
      /*
      {
        text: "Environments",
        items: [
          { text: "Atari", link: "/environments/atari" },
          { text: "Minecraft", link: "/environments/minecraft" },
          { text: "Mujoco", link: "/environments/mujoco" },
        ],
      },
      {
        text: "Frameworks",
        items: [
          { text: "Acme", link: "/frameworks/acme" },
          { text: "Dopamine", link: "/frameworks/dopamine" },
          { text: "Jax RL", link: "/frameworks/jax-rl" },
        ],
      },
      */
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/mila-iqia/rl-docs" },
    ],
    editLink: {
      pattern: "https://github.com/mila-iqia/rl-docs/edit/main/:path",
    },
    search: {
      provider: "local",
    },
    outline: "deep",
  },
});
