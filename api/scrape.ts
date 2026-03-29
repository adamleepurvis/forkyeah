// Vercel serverless function — proxies recipe URL fetch to avoid browser CORS restrictions

function findRecipeSchema(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (Array.isArray(json)) {
    return (json as unknown[]).find(
      (j): j is Record<string, unknown> =>
        typeof j === 'object' && (j as Record<string, unknown>)['@type'] === 'Recipe',
    ) ?? null;
  }
  if (obj['@type'] === 'Recipe') return obj;
  if (Array.isArray(obj['@graph'])) {
    return (obj['@graph'] as unknown[]).find(
      (j): j is Record<string, unknown> =>
        typeof j === 'object' && (j as Record<string, unknown>)['@type'] === 'Recipe',
    ) ?? null;
  }
  return null;
}

const PROTEIN_KEYWORDS: [string, string[]][] = [
  ['chicken', ['chicken']],
  ['salmon', ['salmon']],
  ['shrimp', ['shrimp', 'prawn']],
  ['beef', ['beef', 'steak', 'ground beef', 'brisket']],
  ['pork', ['pork', 'bacon', 'ham', 'sausage', 'pancetta']],
  ['lamb', ['lamb']],
  ['tofu', ['tofu', 'tempeh']],
  ['veggie', ['vegetarian', 'vegan', 'veggie']],
];

function detectProtein(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [protein, keywords] of PROTEIN_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return protein;
  }
  return undefined;
}

function parseDurationMinutes(iso: string): number {
  const hours = parseInt((iso.match(/(\d+)H/) ?? [])[1] ?? '0');
  const mins = parseInt((iso.match(/(\d+)M/) ?? [])[1] ?? '0');
  return hours * 60 + mins;
}

export default async function handler(req: any, res: any) {
  const url = typeof req.query.url === 'string' ? req.query.url : null;
  if (!url) return res.status(400).json({});

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const html = await response.text();

    const ldJsonRegex =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = ldJsonRegex.exec(html)) !== null) {
      try {
        const schema = findRecipeSchema(JSON.parse(match[1]));
        if (!schema) continue;

        const result: Record<string, unknown> = {};

        if (typeof schema.name === 'string') result.title = schema.name;

        if (Array.isArray(schema.recipeIngredient) && schema.recipeIngredient.length > 0) {
          result.ingredients = schema.recipeIngredient;
        }

        const textForProtein = [
          ...(Array.isArray(schema.recipeIngredient) ? schema.recipeIngredient : []),
          ...(Array.isArray(schema.recipeCategory)
            ? schema.recipeCategory
            : [schema.recipeCategory ?? '']),
          schema.keywords ?? '',
          schema.name ?? '',
        ].join(' ');
        const protein = detectProtein(textForProtein);
        if (protein) result.protein = protein;

        const totalTime = schema.totalTime ?? schema.cookTime ?? schema.prepTime;
        if (typeof totalTime === 'string') {
          const mins = parseDurationMinutes(totalTime);
          if (mins > 0) result.timing = mins <= 45 ? 'weekday' : 'weekend';
        }

        return res.status(200).json(result);
      } catch {
        continue;
      }
    }

    return res.status(200).json({});
  } catch {
    return res.status(200).json({});
  }
}
