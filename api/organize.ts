// Vercel serverless function — uses Claude Haiku to organize a shopping list

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Organize this grocery shopping list. Combine duplicate or similar items and merge quantities where sensible (e.g. "2 chicken breasts" + "1 chicken thigh" → "2 chicken breasts, 1 chicken thigh"). Group items by category.

Items:
${items.join('\n')}

Return a JSON array only — no explanation, no markdown, just the array. Each object must have:
- "name": the ingredient string
- "category": one of exactly these values: Produce, Meat & Fish, Dairy & Eggs, Pantry, Bakery, Frozen, Spices & Herbs, Other

Order the array by category so all Produce items are together, then Meat & Fish, etc.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message ?? 'Claude API error' });
    }

    const text = data.content?.[0]?.text ?? '[]';
    // Strip any accidental markdown code fences
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const organized = JSON.parse(cleaned);

    return res.status(200).json({ items: organized });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? 'Unknown error' });
  }
}
