import { defineConfig } from 'vitepress'

// For GitHub Pages deployment under a repository subpath, uncomment and adjust:
// base: '/svg-path-studio-docs/',

export default defineConfig({
  lang: 'en-US',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }]],
  title: 'SVG Path Studio',
  titleTemplate: '%s | SVG Path Studio',
  description:
    'Edit SVG paths with precision — in your browser, no framework attached. An interactive canvas, ribbon UI, transforms, optimizer, and a zero-dependency headless path engine.',
  themeConfig: {
    logo: { src: '/icon.svg', alt: 'SVG Path Studio' },
    siteTitle: 'SVG Path Studio',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Engine', link: '/engine/overview', activeMatch: '/engine/' },
      { text: 'Project', link: '/project/deployment', activeMatch: '/project/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Overview',
          items: [{ text: 'Getting started', link: '/guide/getting-started' }],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Interactive canvas', link: '/guide/canvas' },
            { text: 'Editing paths (Home)', link: '/guide/editing' },
            { text: 'Insert commands', link: '/guide/insert' },
            { text: 'Transforms & path tools', link: '/guide/transform' },
            { text: 'View, grid & viewBox', link: '/guide/view' },
            { text: 'Export & share', link: '/guide/export-and-share' },
            { text: 'Keyboard shortcuts', link: '/guide/keyboard-shortcuts' },
          ],
        },
      ],
      '/engine/': [
        {
          text: 'Path engine',
          items: [
            { text: 'Overview', link: '/engine/overview' },
            { text: 'Optimizer flags', link: '/engine/optimize' },
          ],
        },
        {
          text: 'Separate pages',
          items: [
            { text: 'Headless editor', link: '/engine/headless' },
            { text: 'Deployment & publishing', link: '/project/deployment' },
          ],
        },
      ],
      '/project/': [
        {
          text: 'Project',
          items: [{ text: 'Deployment & publishing', link: '/project/deployment' }],
        },
        {
          text: 'More',
          items: [
            { text: 'Engine overview', link: '/engine/overview' },
            { text: 'Headless editor', link: '/engine/headless' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search docs' },
        },
      },
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/bookklik-technologies/svg-path-studio',
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Bookklik Technologies',
    },
    outline: { level: [2, 3], label: 'On this page' },
    lastUpdated: true,
  },
})
