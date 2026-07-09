# Proxy del Validador de Prompts (Vercel)

Este proyecto es un intermediario seguro entre el **Validador de Prompts** (el sitio en GitHub Pages) y la **API de Claude**. Tu API key de Anthropic vive únicamente en las variables de entorno de Vercel — nunca se expone en el código público del sitio.

```
Navegador del equipo → GitHub Pages (validador) → Vercel (este proxy, con tu API key) → API de Claude
```

## Por qué existe este paso intermedio

Si la API key se pusiera directamente en el código del sitio de GitHub Pages, cualquier persona podría abrir "Ver código fuente" y copiarla, usándola a tu costo. Este proxy resuelve eso: la key solo existe en el servidor de Vercel, protegida como "secreto".

## Desplegar en 5 minutos

### 1. Crea el proyecto en Vercel
1. Sube esta carpeta (`prompt-validator-proxy`) a un repositorio de GitHub (puede ser privado).
2. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → importa ese repositorio.
3. Framework Preset: deja "Other" (no necesita build).
4. Haz clic en **Deploy**.

### 2. Configura tu API key como secreto
1. En el proyecto de Vercel: **Settings → Environment Variables**.
2. Agrega:
   - `ANTHROPIC_API_KEY` → tu key de [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - `ALLOWED_ORIGINS` → la URL de tu sitio de GitHub Pages, ej. `https://tu-usuario.github.io` (sin barra final). Puedes poner varias separadas por comas.
3. Vuelve a **Deployments** y haz **Redeploy** para que tome las variables nuevas.

### 3. Copia la URL de tu proxy
Vercel te da una URL como `https://prompt-validator-proxy.vercel.app`. El endpoint completo es:

```
https://prompt-validator-proxy.vercel.app/api/evaluate
```

### 4. Conéctala en el Validador
Abre tu sitio del Validador de Prompts → botón **"Evaluar con IA (Claude)"** → pega esa URL en el campo de configuración la primera vez. Queda guardada en el navegador de cada persona (no se comparte con nadie más).

## Probar en local (opcional)

```bash
npm install -g vercel
cp .env.example .env.local   # y pon tu API key real ahí
vercel dev
```

Esto levanta el proxy en `http://localhost:3000/api/evaluate`.

## Costos y límites

- Cada evaluación hace una llamada a la API de Claude (modelo `claude-sonnet-5`, ~1200 tokens de salida). Revisa precios actuales en [docs.claude.com](https://docs.claude.com).
- El proxy incluye un límite básico de 15 solicitudes por minuto por IP para frenar abuso accidental. Para un equipo grande con mucho tráfico, considera un rate limiter más robusto (ej. Upstash Redis) — este es un punto de partida, no una solución a prueba de balas.
- Recomendado: pon un límite de gasto mensual en tu cuenta de Anthropic Console como red de seguridad.

## Seguridad

- `ANTHROPIC_API_KEY` nunca se envía al navegador — solo vive en el entorno de Vercel.
- El proxy valida el origen de las solicitudes contra `ALLOWED_ORIGINS`. Configúralo con la URL real de tu sitio antes de compartirlo con el equipo.
- El proxy limita el tamaño del prompt a 6000 caracteres para controlar costos.
