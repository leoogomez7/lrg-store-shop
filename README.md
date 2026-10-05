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

La búsqueda con IA usa la API de OpenAI y búsqueda web. Para desarrollo local, definí
`OPENAI_API_KEY=tu_clave` en el archivo `.env` que está junto a la carpeta del proyecto (Vite ya
lee ahí la configuración existente). Para producción, agregá
`OPENAI_API_KEY` en **Vercel → Project Settings → Environment Variables** para los entornos que
uses y volvé a desplegar. No la incluyas en variables `VITE_*`, no la guardes en el repositorio y
no la pegues en el chat: la clave se debe leer solo en el servidor.

Opcionalmente, `OPENAI_PERFUME_MODEL` permite elegir otro modelo compatible con la herramienta
`web_search`; el valor predeterminado es `gpt-4.1-mini`. La cuenta de OpenAI debe tener API habilitada.
