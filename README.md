# openrouter-3model-chat-api

A free, public Cloudflare Workers API that calls OpenRouter and returns
responses from three fixed models in parallel.

## Models
- openai/gpt-5.2
- google/gemini-3-pro-preview
- anthropic/claude-sonnet-4.5

## Endpoints

### GET /health
Health check.

### POST /chat
Request body:
```json
{
  "message": "hello",
  "sessionId": "abc123"
}
```

Response:
```json
{
  "sessionId": "abc123",
  "input": "hello",
  "outputs": {
    "gpt5_2": { "reply": "..." },
    "gemini3pro": { "reply": "..." },
    "claude_sonnet_4_5": { "reply": "..." }
  }
}
```
