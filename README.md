# Your PDF Companion

This project is built with Vite, React, and TanStack Start.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

## Importación de notas de perfumes

La búsqueda con IA usa la API de OpenAI y búsqueda web. Configurá `OPENAI_API_KEY` como variable
de entorno del servidor (por ejemplo, en `.env` para desarrollo local y en las variables de entorno
de Vercel para producción). No la incluyas en variables `VITE_*` ni en el código del navegador.

Opcionalmente, `OPENAI_PERFUME_MODEL` permite elegir otro modelo compatible con la herramienta
`web_search`; el valor predeterminado es `gpt-4.1-mini`. La cuenta de OpenAI debe tener API habilitada.
