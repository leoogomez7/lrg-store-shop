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

La búsqueda con IA usa Gemini 2.5 Flash con Google Search Grounding. Google ofrece una cuota
gratuita para este modelo y su búsqueda web (actualmente hasta 500 solicitudes de búsqueda por día,
sujeto a límites de frecuencia y disponibilidad). Revisá los [precios y cuotas oficiales](https://ai.google.dev/gemini-api/docs/pricing).

Creá una clave en [Google AI Studio](https://aistudio.google.com/apikey). Para desarrollo local,
definí `GEMINI_API_KEY=tu_clave` en el archivo `.env` que está junto a la carpeta del proyecto.
Para producción, agregá `GEMINI_API_KEY` en **Vercel → Project Settings → Environment Variables**
y volvé a desplegar. No la incluyas en variables `VITE_*`, no la guardes en el repositorio y no la
compartas: la clave se debe leer solo en el servidor.

Opcionalmente, `GEMINI_PERFUME_MODEL` permite cambiar el modelo; por defecto se usa
`gemini-2.5-flash`.
