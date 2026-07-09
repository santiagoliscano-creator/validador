# Validador de Prompts

Herramienta web para evaluar prompts antes de enviarlos a la IA. Analiza en vivo 7 ingredientes (tarea, contexto, especificidad, formato, ejemplos, estructura y rol), entrega un puntaje de 0 a 100 con sugerencias concretas, detecta palabras vagas y genera un meta-prompt para pedirle a Claude una evaluación aún más profunda.

Es un único archivo `index.html` sin dependencias ni backend: funciona en cualquier hosting estático.

## Publicar en GitHub Pages (5 minutos)

1. Crea un repositorio nuevo en GitHub (por ejemplo `validador-de-prompts`) y márcalo como **Public**.
2. Sube el archivo `index.html` (y este README) a la raíz del repositorio. Puedes arrastrarlo directamente en la web de GitHub con **Add file → Upload files**.
3. En el repositorio ve a **Settings → Pages**.
4. En **Source** elige **Deploy from a branch**, branch `main`, carpeta `/ (root)` y guarda.
5. Espera 1–2 minutos. Tu sitio quedará publicado en:
   `https://TU-USUARIO.github.io/validador-de-prompts/`

Ese es el link que compartes con el equipo (y el que va en la slide 12 de la capacitación).

## Personalización rápida

- **Criterios y pesos**: edita el arreglo `CRITERIA` dentro de `index.html` (cada criterio tiene `pts`, la regex `test` y los textos de feedback).
- **Palabras vagas**: edita el arreglo `VAGUE`.
- **Ejemplos precargados**: edita las constantes `EX_BAD` y `EX_GOOD`.
- **Colores y tipografía**: edita las variables CSS en `:root`.

## Nota sobre el puntaje

El chequeo instantáneo (el que ves apenas escribes) es una guía basada en reglas (heurísticas): sirve como checklist rápido y funciona sin conexión ni configuración.

## Evaluación profunda con IA (opcional)

El botón **"Evaluar con IA (Claude)"** llama a un proxy propio desplegado en Vercel, que a su vez llama a la API de Claude para leer el prompt de verdad y dar feedback razonado (no solo reglas). Requiere desplegar ese proxy una vez — instrucciones completas en el proyecto hermano `prompt-validator-proxy/README.md`.

La primera vez que alguien del equipo use ese botón, se le pedirá pegar la URL del proxy (ej. `https://tu-proxy.vercel.app/api/evaluate`). Queda guardada solo en su navegador (localStorage), no se comparte con nadie más ni se sube a GitHub.

**Por qué no se llama a la API de Claude directamente desde este sitio:** hacerlo expondría tu API key en el código público de GitHub Pages, visible para cualquiera con "Ver código fuente". El proxy resuelve esto manteniendo la key solo en el servidor de Vercel.
