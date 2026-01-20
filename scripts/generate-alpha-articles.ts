import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { blogPosts, generateBlogSlug } from '../shared/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
const sql = neon(DATABASE_URL);
const db = drizzle(sql);

interface ArticleSpec {
  title: string;
  category: 'strategy' | 'tax' | 'wealth';
  focus: string;
}

const ALPHA_ARTICLES: ArticleSpec[] = [
  {
    title: "The 831(b) Edge: Why Your CPA is the Key to Captive Insurance Success",
    category: 'tax',
    focus: `Write an article focused on the critical role of CPAs in implementing successful 831(b) captive insurance strategies.
    Cover:
    - Why captive insurance requires CPA expertise (not just insurance brokers)
    - The compliance landmines that trip up business owners without strategic CPA guidance
    - How CPAs ensure proper premium calculation and IRS defensibility
    - The ongoing reporting requirements that require CPA involvement
    - Real scenarios where poor CPA selection led to IRS challenges
    - What to look for in a CPA who specializes in 831(b) structures
    Emphasize that the RIGHT CPA can be the difference between a legitimate tax strategy and an IRS audit nightmare.`
  },
  {
    title: "The Alpha Advantage: How Wealth Advisors Use Reinsurance to De-Risk Portfolios",
    category: 'wealth',
    focus: `Write an article about how sophisticated wealth advisors incorporate reinsurance strategies into comprehensive wealth management.
    Cover:
    - The intersection of reinsurance and wealth management (beyond just tax savings)
    - How reinsurance creates uncorrelated assets in a portfolio
    - Risk transfer mechanisms that protect family wealth
    - The role of wealth advisors in coordinating reinsurance with overall financial planning
    - Integration with estate planning and multi-generational wealth transfer
    - Why high-net-worth clients need advisors who understand both sides
    Position wealth advisors who understand reinsurance as providing a distinct competitive advantage.`
  },
  {
    title: "Beyond Compliance: Why $5M+ Business Owners are Firing 'Tax Historians' for 'Strategic Partners'",
    category: 'strategy',
    focus: `Write a provocative article about the shift from traditional CPAs to strategic advisors.
    Cover:
    - The difference between "tax historians" (reactive) vs "strategic partners" (proactive)
    - Why $5M+ revenue businesses have fundamentally different needs
    - Specific strategies that traditional CPAs miss: cost segregation, captive insurance, QSBS, etc.
    - The opportunity cost of working with the wrong advisor (quantify the potential savings)
    - How to identify if your current CPA is a "historian" or a "strategist"
    - The qualities that define a true strategic advisor partnership
    - When and how to make the switch without disrupting your business
    Be bold and direct - this should resonate with frustrated business owners who feel they're overpaying in taxes.`
  }
];

async function generateArticle(spec: ArticleSpec): Promise<{ content: string; excerpt: string; readTime: string }> {
  console.log(`Generating article: ${spec.title}`);

  const prompt = `You are an expert financial content writer for "The Alpha Directory" - a premium platform connecting business owners with strategic CPAs and Wealth Managers.

Write a comprehensive, authoritative article (1,200-1,500 words) on the following topic:

Title: ${spec.title}

Focus: ${spec.focus}

Target Audience: Business owners with $5M+ annual revenue who are looking to optimize their tax strategy and build wealth through sophisticated planning.

Requirements:
1. Use a professional but accessible tone - authoritative yet approachable
2. Include specific examples and scenarios that resonate with successful business owners
3. Break up content with clear section headers (use ## for h2, ### for h3)
4. Include actionable takeaways and red flags to watch for
5. Reference real strategies without giving specific legal/financial advice
6. Make the content SEO-friendly with natural keyword usage
7. Position CPAs and Wealth Advisors as essential partners, not just service providers
8. End with a call-to-action encouraging readers to find an "Alpha Advisor"

Format the article with:
- Compelling introduction that hooks the reader immediately
- 3-5 main sections with clear headers
- Bullet points and lists where appropriate for scanability
- Strong conclusion with clear next steps

Do NOT include the title in the content - it will be added separately.
Do NOT use generic advice - be specific and valuable.

Return ONLY the article content, no additional commentary.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const content = textContent.text.trim();

  // Calculate read time (average 200 words per minute)
  const wordCount = content.split(/\s+/).length;
  const readTime = `${Math.ceil(wordCount / 200)} min read`;

  // Generate excerpt
  const excerptPrompt = `Write a compelling 2-sentence excerpt (150-200 characters) for this article that would make a $5M+ business owner want to read more. Be direct and value-focused:

${content.substring(0, 1000)}...

Return ONLY the excerpt, no quotes or additional text.`;

  const excerptResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: excerptPrompt,
      },
    ],
  });

  const excerptContent = excerptResponse.content[0];
  if (excerptContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return {
    content,
    excerpt: excerptContent.text.trim(),
    readTime,
  };
}

async function main() {
  console.log('='.repeat(50));
  console.log('Alpha Articles Generator');
  console.log('='.repeat(50));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  for (const spec of ALPHA_ARTICLES) {
    console.log(`\nProcessing: ${spec.title}`);
    console.log('-'.repeat(40));

    try {
      const { content, excerpt, readTime } = await generateArticle(spec);
      const slug = generateBlogSlug(spec.title);

      // Insert into database
      await db.insert(blogPosts).values({
        title: spec.title,
        slug,
        excerpt,
        content,
        category: spec.category,
        readTime,
        isPublished: true,
      });

      console.log(`SUCCESS: Created "${spec.title}"`);
      console.log(`  Slug: ${slug}`);
      console.log(`  Read time: ${readTime}`);
      console.log(`  Excerpt: ${excerpt.substring(0, 80)}...`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`SKIPPED: Article already exists`);
      } else {
        console.error(`ERROR: ${error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Alpha Articles Generation Complete');
  console.log('='.repeat(50));
}

main();
