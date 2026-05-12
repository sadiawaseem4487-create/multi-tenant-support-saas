# n8n: per-org chat behavior

After Tier 1 chat customization lands in the Next.js app, `/api/chat` forwards
each request to n8n with an extra `chat_config` object:

```json
{
  "question": "How do I return a product?",
  "company_name": "NovaCompany",
  "org_id": "uuid-of-acme",
  "org_name": "Acme Ltd",
  "correlation_id": "...",
  "chat_config": {
    "assistant_name": "Aria",
    "persona": "You are friendly, concise, and address the user formally.",
    "fallback_message": "I don't have that information yet. Email support@acme.com.",
    "language_policy": "match-user",
    "show_citations": false
  }
}
```

`language_policy` is one of:
- `match-user` — reply in whichever language the visitor's question is in (default)
- `english-only` — always reply in English regardless of input language
- `original-language` — reply in the language of the knowledge-base content

`show_citations` — when `true`, the assistant should append a short
"Sources:" list referencing the retrieved chunks.

To make the LLM actually USE this config, two nodes in the chat path need
small edits.

## 1. Edit the `Code in JavaScript1` node (between Search Similar Chunks and Generate Answer)

Replace its JS with:

```js
const context = items
  .map((it, i) => `Source ${i + 1}:\n${it.json.content}`)
  .join('\n\n---\n\n');

const webhookData = $('Webhook').first().json;
const body = webhookData.body || webhookData;

const question = String(
  body.question || body.message || body.chatInput || ''
).trim();

const cfg = body.chat_config || {};
const orgName = body.org_name || body.company_name || 'Support';
const assistantName = cfg.assistant_name || orgName;
const persona = (cfg.persona || '').trim();
const fallback = (cfg.fallback_message || "I don't have that information in my knowledge base yet.").trim();

const languageRule = ({
  'match-user': 'Reply in the same language as the visitor\u2019s question.',
  'english-only': 'Always reply in English regardless of the visitor\u2019s language.',
  'original-language': 'Reply in the language of the knowledge-base content.',
}[cfg.language_policy]) || 'Reply in the same language as the visitor\u2019s question.';

const citationsRule = cfg.show_citations
  ? 'At the end of the answer, add a short list titled "Sources:" referencing the most relevant context chunks by their Source number.'
  : 'Do not list sources or citations.';

const systemPrompt = [
  `You are ${assistantName}, the support assistant for ${orgName}.`,
  persona,
  '',
  'Answer ONLY using the provided context.',
  'If the context is empty or insufficient, respond with this exact message:',
  fallback,
  '',
  languageRule,
  citationsRule,
].filter(Boolean).join('\n');

return [
  {
    json: {
      context,
      question,
      systemPrompt,
    },
  },
];
```

What changed: the node now also returns `systemPrompt`, computed from the
incoming `chat_config` (with safe fallbacks).

## 2. Edit the `Generate Answer` node

Find its **Body Parameters → messages** field. Replace the current value with:

```
={{[
  {
    role: "system",
    content: $json.systemPrompt
  },
  {
    role: "user",
    content: `Context:\n${$json.context}\n\nQuestion:\n${$json.question}`
  }
]}}
```

What changed: the hardcoded system prompt is gone; the node uses
`$json.systemPrompt` produced by the upstream Code node.

## 3. Verify

1. In `/admin/settings` (as org_owner), set:
   - Assistant name: `Nova`
   - Persona: `You are warm, concise, and use plain language.`
   - Greeting: a custom one
   - Suggestions: a custom set
   - Fallback message: `Please email help@novamart.example`
2. Save.
3. Ask a question whose answer is NOT in your KB.
4. Expected: the response is your custom fallback message — exactly.
5. Ask a question whose answer IS in your KB.
6. Expected: the answer tone reflects your persona, and the assistant refers
   to itself as the configured name.

## Safety notes

- `persona` is concatenated into the system prompt verbatim. Treat it as
  trusted input from your own admins (org_owner / org_admin only — enforced
  by `requireRole` in `/api/admin/orgs/settings`).
- The user-visible "fallback message" is repeated to the LLM as the
  instruction; the LLM will produce it verbatim in most cases. If you want
  guarantees, the Next.js app could post-process the answer and substitute
  on an exact match, but for v1 the LLM honors it well enough.
- If `chat_config` is missing from the request (e.g., legacy callers), the
  Code node falls back to a generic system prompt, so nothing breaks.
