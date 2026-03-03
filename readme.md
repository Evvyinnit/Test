# Project: etestnim

This is a React-based application deployed on Netlify. It features:

- AI Chat integration using Gemini.
- User authentication and data storage with Firebase/Firestore.
- Modern UI built with React and Tailwind CSS.
- Netlify Functions for serverless logic.

## Getting Started

To run this project locally, use the following commands:

```bash
npm install
npm run dev
```

To run with Netlify CLI:

```bash
netlify dev
```

## Performance Notes

The build uses Vite minification with hashed assets, lazy-loaded Firebase modules, and route/component code splitting to keep initial bundles small. Netlify is configured for gzip/brotli compression and long-term asset caching, while critical fonts/background assets are preloaded for faster first paint.
