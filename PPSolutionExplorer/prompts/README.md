# Prompts

Versioned prompt templates used by the optional AI layer (`src/Ai`). One file per prompt: `<name>.prompt.json`.

| Field | Meaning |
|---|---|
| `name` | Stable identifier used in code. |
| `version` | **Bump on every change.** Part of the cache key and stored on every AI output. |
| `system` / `user` | Messages. `{{placeholder}}` slots are filled by the service. |
| `schema` | JSON schema for structured output (llama.cpp turns it into a grammar). Output is also validated server-side. Omit for streamed free text. |
| `temperature`, `maxOutputTokens` | Per-prompt overrides. Structured prompts are clamped to 0-0.2. |

Rules:
- Flow content is untrusted. It is always wrapped in `<flow_data>…</flow_data>` and the system message says to treat it as data.
- Content is redacted before rendering (env variable values, secrets, emails, GUIDs, tenant URLs).
- Cache key = SHA-256(prompt name@version + model + rendered content). Changing a prompt without bumping the version serves stale cached output.
