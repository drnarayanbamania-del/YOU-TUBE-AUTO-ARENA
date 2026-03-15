# Vercel Environment Setup

Configure these Environment Variables in Vercel Project Settings → Environment Variables.

## Required
- `YOUTUBE_API_KEY`
- `OPENAI_API_KEY`
- `SARVAM_API_KEY`

## Recommended Sarvam Voice Defaults
- `SARVAM_API_BASE_URL=https://api.sarvam.ai`
- `SARVAM_TTS_MODEL=bulbul:v2`
- `SARVAM_TTS_SPEAKER=meera`
- `SARVAM_LANGUAGE_CODE=hi-IN`
- `SARVAM_SAMPLE_RATE=22050`

## Notes
- Keep all API keys server-side only.
- Do not place Sarvam/OpenAI/YouTube secrets in frontend code.
- Frontend should call the Vercel serverless routes under `/api/*`.
