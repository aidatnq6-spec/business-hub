# AI provider validation — 2026-10-22

Read-only inspection; no API key, generation request or cloud mutation was used.

- [Gemini model metadata REST reference](https://ai.google.dev/api/models): documents `GET /v1beta/models` and model metadata, not an end-to-end image/speech test. It does not explicitly establish a no-charge guarantee for this endpoint; the application returns `ai_check_needs_confirmation` without making an outbound request. A billable generate request is never substituted.
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing): Standard rates verified for `gemini-3.1-flash-lite`: USD 0.25/million text input tokens and USD 1.50/million output including thinking. For `gemini-3.1-flash-lite-image`: USD 0.25/million input, USD 1.50/million text/thinking output, USD 30/million image output. No grounding/tools or batch pricing is assumed.
- [Gemini supported models](https://ai.google.dev/gemini-api/docs/models): capabilities and lifecycle differ per model. Existing candidate names are not automatically accepted.
- [Gemini model lifecycle](https://ai.google.dev/gemini-api/docs/models): Gemini 3.1 Flash-Lite and Nano Banana 2 Lite are published separately for text and image. Older 2.5 lifecycle information is not used to reject these 3.1 choices.
- [Gemini token accounting](https://ai.google.dev/gemini-api/docs/tokens): usage includes thinking and modality-dependent counts; unknown usage cannot be settled at zero.
- [Cloud Text-to-Speech authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication): uses Google Cloud identity/ADC, separate from a Gemini API key; voice approval and worker configuration remain independent.

The immutable primary catalog contains those two Gemini choices, Neural2 speech and the local render template; fallback remains empty. [Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing) lists Neural2 at USD16/million characters after free usage; the budget assumes paid usage and never assumes free quota. TTS identity and voice approval are separate. Template rendering adds no AI-generation fee but has infrastructure costs.

Verification date: 2026-10-22. Internal review expiry: 2026-11-21 (not a vendor price guarantee). VND costs use a conservative internal assumption of 30,000VND/USD and 20% buffer, not a current exchange quote. Image output without modality token counts remains reserved for reconciliation. Runtime also requires a separately reviewed cost window and activation approval; saving a key or budget does not enable generation/scheduling.

Metadata checking defaults to blocked behind `AI_SETTINGS_METADATA_CHECK_VERIFIED=false` because the documentation does not explicitly establish its no-charge guarantee. Its implemented opt-in branch performs only a GET of the allowlisted model's metadata, key in header, no redirects, timeout10s. It is tested with fake fetch only. Operator verification must precede enabling it; no generate request is substituted. A metadata success does not certify image/speech/video generation. No real AI credential has been used in this implementation.
