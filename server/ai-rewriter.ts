import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface RewrittenBio {
  bio: string;
  specialties: string[];
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rewrite bio with retry logic
 */
export async function rewriteBioForSEO(
  originalBio: string,
  advisorName: string,
  designation: string,
  location: string
): Promise<RewrittenBio> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  [AI] Rewrite attempt ${attempt}/${MAX_RETRIES}...`);
      const result = await performRewrite(originalBio, advisorName, designation, location);
      console.log(`  [AI] Rewrite successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`  [AI] Attempt ${attempt} failed: ${(error as Error).message}`);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
        console.log(`  [AI] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  throw lastError || new Error('All rewrite attempts failed');
}

/**
 * Internal rewrite function (single attempt)
 */
async function performRewrite(
  originalBio: string,
  advisorName: string,
  designation: string,
  location: string
): Promise<RewrittenBio> {
  const prompt = `You are an SEO content specialist for a financial advisor directory focused on Strategic Wealth and Tax Planning.

Rewrite the following advisor bio to be:
1. Completely unique (no duplicate content penalty from Google)
2. Professional and authoritative in tone
3. Focused on Strategic Wealth and Tax Planning themes
4. Optimized for SEO with natural keyword usage
5. Between 150-300 words
6. Highlighting their expertise in areas like: captive insurance, reinsurance strategies, tax optimization, wealth preservation, and business succession planning

Also extract or infer 3-5 key specialties from the bio.

Advisor Details:
- Name: ${advisorName}
- Designation: ${designation}
- Location: ${location}
- Original Bio: ${originalBio || 'No bio provided'}

Respond in JSON format only:
{
  "bio": "The rewritten bio text here...",
  "specialties": ["Specialty 1", "Specialty 2", "Specialty 3"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    // Extract JSON from the response (handle markdown code blocks if present)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }

    const result = JSON.parse(jsonText.trim());
    return {
      bio: result.bio,
      specialties: result.specialties || [],
    };
  } catch (error) {
    console.error('Failed to parse Claude response:', content.text);
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function generateFallbackBio(
  advisorName: string,
  designation: string,
  location: string,
  firmName?: string
): Promise<RewrittenBio> {
  const firm = firmName ? ` at ${firmName}` : '';
  return {
    bio: `${advisorName} is a distinguished ${designation}${firm} based in ${location}. With a focus on strategic wealth and tax planning, ${advisorName} helps clients navigate complex financial decisions and optimize their tax positions. Specializing in innovative risk management solutions including captive insurance and reinsurance strategies, ${advisorName} delivers comprehensive financial guidance tailored to each client's unique situation.`,
    specialties: ['Tax Planning', 'Wealth Management', 'Risk Management'],
  };
}
