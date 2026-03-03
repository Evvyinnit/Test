// Netlify Function: Proxy for Anthropic Claude API
// Uses server-side ANTHROPIC_API_KEY for reliable chat
// Streams responses back to the client in OpenAI-compatible SSE format

const CLAUDE_MODELS = {
  'claude-haiku': {
    model: 'claude-3-5-haiku-20241022',
    tempMin: 0,
    tempMax: 1.0,
    tempDefault: 0.8,
  },
  'claude-sonnet': {
    model: 'claude-3-5-sonnet-20241022',
    tempMin: 0,
    tempMax: 1.0,
    tempDefault: 0.7,
  },
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, model, temperature } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const selectedModel = model && CLAUDE_MODELS[model] ? model : 'claude-haiku';
    const modelConfig = CLAUDE_MODELS[selectedModel];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract system message
    const systemContent = messages.find(m => m.role === 'system')?.content || '';
    let chatMessages = messages.filter(m => m.role !== 'system');

    // Anthropic requires messages to start with 'user' and alternate roles
    if (chatMessages.length > 0 && chatMessages[0].role === 'assistant') {
      chatMessages = [
        { role: 'user', content: '[Start]' },
        ...chatMessages,
      ];
    }

    // Merge consecutive same-role messages (Anthropic requires strict alternation)
    const mergedMessages = [];
    for (const msg of chatMessages) {
      if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
        mergedMessages[mergedMessages.length - 1].content += '\n' + msg.content;
      } else {
        mergedMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Clamp temperature to model's allowed range
    let temp = temperature != null ? temperature : modelConfig.tempDefault;
    temp = Math.max(modelConfig.tempMin, Math.min(modelConfig.tempMax, temp));

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelConfig.model,
        max_tokens: 2048,
        system: systemContent,
        messages: mergedMessages,
        temperature: temp,
        stream: true,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Anthropic API error:', apiResponse.status, errText);
      let errorMsg = `API returned ${apiResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errorMsg;
      } catch {}
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: apiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform Anthropic SSE to OpenAI-compatible SSE format
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Convert to OpenAI-compatible SSE chunk
                const chunk = {
                  choices: [{
                    delta: { content: parsed.delta.text },
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
    console.error('Chat function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/.netlify/functions/chat',
};
