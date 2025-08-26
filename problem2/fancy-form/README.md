# Fancy Form

🚀 **Live Demo**: [https://99tech.linhpham.net/](https://99tech.linhpham.net/)

A modern React + TypeScript + Vite application with TailwindCSS, Radix UI, Zustand, and React Hook Form.
This project implements **Problem 2 - Fancy Form**.

---

## Tech Stack

- [React 19](https://react.dev/) with TypeScript
- [Vite 7](https://vitejs.dev/) for fast build and HMR
- [TailwindCSS 4](https://tailwindcss.com/) for styling
- [Shadcn UI](https://ui.shadcn.com/) for accessible components
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for forms & validation
- [Zustand](https://zustand-demo.pmnd.rs/) for state management
- [i18next](https://www.i18next.com/) for translations
- ESLint + TypeScript ESLint for linting and type safety

---

## Development

### Install dependencies

```bash
pnpm install
# or
yarn install
# or
npm install
```

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

---

## ESLint ConfigurationType-aware linting with `typescript-eslint` is enabled. Example config:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

React-specific linting is supported with:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
  },
])
```

---

## Deployment (Docker + VPS Ubuntu)

The app is containerized using Docker for easy deployment.

### Build Docker image

```bash
docker build -t linhpham92/99tech:fancy-form .
```

### Run container locally

```bash
docker run -d -p 5173:5173 linhpham92/99tech:fancy-form
```

### Push to DockerHub

```bash
docker login
docker push linhpham92/99tech:fancy-form
```

### Deploy on VPS Ubuntu

1. SSH into your VPS
   ```bash
   ssh user@your-vps-ip
   ```
2. Pull the latest image
   ```bash
   docker pull linhpham92/99tech:fancy-form
   ```
3. Run the container
   ```bash
   docker run -d -p 80:5173 linhpham92/99tech:fancy-form
   ```
4. Configure Nginx (reverse proxy + SSL via Certbot) to serve on your domain [99tech.linhpham.net](https://99tech.linhpham.net/)

---

## Links

- 🔗 Demo: [https://99tech.linhpham.net/](https://99tech.linhpham.net/)
- 🔗 DockerHub: [linhpham92/99tech](https://hub.docker.com/r/linhpham92/99tech)
