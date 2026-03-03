// Netlify Function: Proxy for Google Gemini API
// Requires user-provided Gemini API key
// Converts OpenAI-style messages to Gemini format and streams back as SSE

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, apiKey, temperature, model, maxOutputTokens, topP, topK } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is required. Add your key in Settings.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiModel = model || 'gemini-flash-latest';

    // Convert OpenAI-style messages to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiBody = {
      contents,
      generationConfig: {
        temperature: temperature != null ? Math.max(0, Math.min(2, temperature)) : 0.9,
        maxOutputTokens: maxOutputTokens || 2048,
        topP: topP || 0.9,
        topK: topK || 40,
      },
    };

    if (systemInstruction) {
      geminiBody.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Gemini API error:', apiResponse.status, errText);
      let errorMsg = `Gemini API returned ${apiResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errorMsg;
      } catch {}
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: apiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    (async () => {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Convert to OpenAI-compatible SSE format
                const chunk = {
                  choices: [{
                    delta: { content: text },
                    index: 0,
                  }],
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        console.error('Stream transform error:', err);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Gemini chat function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/.netlify/functions/gemini-chat',
};
