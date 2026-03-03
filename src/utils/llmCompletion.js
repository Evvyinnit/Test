import { getModelConfig } from './settings';

/**
 * Request a completion from the configured provider.
 * Uses OpenAI-compatible endpoints for pawan/groq/mistral and Google Gemini API for gemini.
 *
 * @param {Object} params
 * @param {Array} params.apiMessages - OpenAI-style messages: [{role, content}]
 * @param {Object} params.settings - user settings containing API keys
 * @param {Object} params.characterSettings - per-bot settings (temperature, maxTokens, topP, etc.) and model
 * @param {boolean} [params.stream=false] - streaming not implemented here (kept false for group chat stability)
 */
export async function requestCompletion({ apiMessages, settings, characterSettings, stream = false }) {
  const modelId = characterSettings?.model || settings?.model || 'cosmosrp-2.5';
  const modelConfig = getModelConfig(modelId);
  const provider = modelConfig.provider;

  let apiKey = '';
  if (provider === 'pawan') apiKey = settings?.pawanApiKey || '';
  if (provider === 'gemini') apiKey = settings?.geminiApiKey || '';
  if (provider === 'groq') apiKey = settings?.groqApiKey || '';
  if (provider === 'mistral') apiKey = settings?.mistralApiKey || '';

  if (modelConfig.requiresKey && !apiKey) {
    throw new Error(`Missing API key for ${modelConfig.name}`);
  }

  // OpenAI compatible providers
  if (provider === 'pawan' || provider === 'groq' || provider === 'mistral') {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const body = {
      model: modelId,
      messages: apiMessages,
      temperature: characterSettings?.temperature != null ? characterSettings.temperature : modelConfig.tempDefault,
      max_tokens: characterSettings?.maxTokens || 4096,
      top_p: characterSettings?.topP || 0.9,
      stream: Boolean(stream),
    };

    if (provider === 'pawan') {
      if (characterSettings?.topK) body.top_k = characterSettings.topK;
      if (characterSettings?.repetitionPenalty) body.repetition_penalty = characterSettings.repetitionPenalty;
    }

    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Model request failed (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { content, raw: data };
  }

  // Gemini
  if (provider === 'gemini') {
    const systemMsg = apiMessages.find(m => m.role === 'system');
    const chatMsgs = apiMessages.filter(m => m.role !== 'system');

    const contents = chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // If there's a system message, prepend it as user content with instruction style.
    if (systemMsg?.content) {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemMsg.content }]
      });
    }

    const geminiBody = {
      contents,
      generationConfig: {
        temperature: characterSettings?.temperature != null ? characterSettings.temperature : modelConfig.tempDefault,
        maxOutputTokens: characterSettings?.maxTokens || 2048,
        topP: characterSettings?.topP || 0.9,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini request failed (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return { content, raw: data };
  }

  throw new Error('Unsupported model provider');
}
