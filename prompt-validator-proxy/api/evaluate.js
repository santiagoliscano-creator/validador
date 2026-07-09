// api/evaluate.js
// Proxy seguro entre el Validador de Prompts (GitHub Pages) y la API de Anthropic.
// La API key vive SOLO en las variables de entorno de Vercel — nunca llega al navegador.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const MAX_PROMPT_CHARS = 6000;

// Orígenes permitidos a llamar este proxy. Configura ALLOWED_ORIGINS en Vercel
// como una lista separada por comas, ej: "https://tu-usuario.github.io"
// Si no se configura, se permite cualquier origen (útil para probar, no recomendado en producción).
function getAllowedOrigin(req) {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || "";
  if (configured.length === 0) return "*";
  return configured.includes(origin) ? origin : "";
}

// Rate limit best-effort en memoria (por instancia tibia de la función).
// No sustituye un rate limiter real (Upstash/Vercel KV) en producción con tráfico alto,
// pero frena abuso accidental o scripts repetidos.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 15;

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > MAX_HITS_PER_WINDOW;
}

const SYSTEM_PROMPT = `Eres un evaluador experto en prompt engineering para un equipo de Customer Success que usa IA en tareas comerciales (mensajes a clientes, resúmenes, análisis).

Evalúa el prompt que te entregue el usuario según estos 7 criterios, en este orden exacto:
1. rol — ¿le asigna un rol o persona a la IA?
2. contexto — ¿da contexto de la situación o audiencia?
3. tarea — ¿tiene un verbo de acción claro y una tarea inequívoca?
4. especificidad — ¿usa datos concretos (números, nombres, criterios) en vez de vaguedades?
5. formato — ¿especifica cómo debe verse la salida (largo, tono, estructura)?
6. ejemplos — ¿incluye al menos un ejemplo del resultado esperado (few-shot)?
7. estructura — ¿organiza contexto/datos/instrucciones con etiquetas, listas o secciones separadas?

Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin bloques de código markdown, con este esquema exacto:

{
  "score": <entero 0-100>,
  "level": "<uno de: Nivel Pro | Sólido | En construcción | Borrador>",
  "criteria": [
    {"id":"rol","estado":"<cumple|parcial|falta>","comentario":"<máx 20 palabras, en español>"},
    {"id":"contexto","estado":"...","comentario":"..."},
    {"id":"tarea","estado":"...","comentario":"..."},
    {"id":"especificidad","estado":"...","comentario":"..."},
    {"id":"formato","estado":"...","comentario":"..."},
    {"id":"ejemplos","estado":"...","comentario":"..."},
    {"id":"estructura","estado":"...","comentario":"..."}
  ],
  "mejoras": ["<mejora 1, la de mayor impacto>", "<mejora 2>", "<mejora 3>"],
  "prompt_mejorado": "<una reescritura completa del prompt aplicando las mejoras, lista para usar>"
}

Reglas de puntaje: Nivel Pro = 85-100, Sólido = 65-84, En construcción = 40-64, Borrador = 0-39.
Sé estricto pero constructivo: el objetivo es que la persona aprenda a mejorar su prompt, no solo obtener un número.`;

module.exports = async (req, res) => {
  const allowOrigin = getAllowedOrigin(req);

  res.setHeader("Access-Control-Allow-Origin", allowOrigin || "null");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!allowOrigin) {
    res.status(403).json({ error: "Origen no permitido." });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Usa POST." });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Demasiadas solicitudes. Espera un minuto e intenta de nuevo." });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "El servidor no tiene configurada ANTHROPIC_API_KEY." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = (body && body.prompt ? String(body.prompt) : "").trim();

  if (!prompt) {
    res.status(400).json({ error: "Falta el campo 'prompt'." });
    return;
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(413).json({ error: `El prompt es muy largo (máximo ${MAX_PROMPT_CHARS} caracteres).` });
    return;
  }

  try {
    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Evalúa este prompt:\n\n<prompt_a_evaluar>\n${prompt}\n</prompt_a_evaluar>`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      res.status(502).json({ error: "Error al consultar la API de Claude.", detail: errText.slice(0, 300) });
      return;
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const raw = textBlock ? textBlock.text : "";

    let parsed;
    try {
      const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: "La respuesta del modelo no pudo interpretarse como JSON.", raw: raw.slice(0, 500) });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Error inesperado en el proxy.", detail: String(err).slice(0, 300) });
  }
};
