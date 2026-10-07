const model = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const apiKey = process.env.MSE_OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  console.error('MSE_OPENROUTER_API_KEY is missing from .env.local. Add a fresh key and rerun npm run test:ai.');
  process.exitCode = 1;
} else {
  async function complete(messages) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'Main Stream Electronics AI connectivity test',
      },
      body: JSON.stringify({
        model,
        messages,
        reasoning: { enabled: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('OpenRouter rejected MSE_OPENROUTER_API_KEY (401). Verify the copied key and account access.');
      }
      throw new Error(`OpenRouter test request failed with HTTP ${response.status}.`);
    }
    const message = result.choices?.[0]?.message;
    if (typeof message?.content !== 'string' || !message.content.trim()) {
      throw new Error('OpenRouter returned no assistant text.');
    }
    return message;
  }

  try {
    console.log(`Testing ${model} with two separate requests (key is not displayed)...`);
    const first = await complete([
      { role: 'user', content: 'In one concise sentence, what is a purchase in a retail shop?' },
    ]);
    console.log('\nTest 1 answer:');
    console.log(first.content);

    const followUp = [
      { role: 'user', content: 'In one concise sentence, what is a purchase in a retail shop?' },
      {
        role: 'assistant',
        content: first.content,
        ...(first.reasoning_details !== undefined ? { reasoning_details: first.reasoning_details } : {}),
      },
      { role: 'user', content: 'Give one short electrical shop example.' },
    ];
    const second = await complete(followUp);
    console.log('\nTest 2 answer (reasoning continuation):');
    console.log(second.content);
    console.log('\nOpenRouter model test passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'OpenRouter test failed.');
    process.exitCode = 1;
  }
}
