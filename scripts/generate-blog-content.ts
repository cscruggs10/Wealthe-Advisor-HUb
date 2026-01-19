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

const PILLAR_ARTICLES: ArticleSpec[] = [
  {
    title: 'The Reinsurance Revolution: How Mid-Market Founders are Turning Insurance Premiums into Wealth',
    category: 'strategy',
    focus: 'Explain how reinsurance domiciles and captive insurance strategies allow business owners making $5M+ to convert traditional insurance expenses into wealth-building vehicles. Cover the mechanics, tax benefits, and real-world implementation.'
  },
  {
    title: 'Why Your Current CPA is Probably Costing You $100k/Year (And How to Spot a Strategic Advisor)',
    category: 'tax',
    focus: 'Contrast traditional CPAs (reactive, compliance-focused) with strategic tax advisors (proactive, wealth-building focused). Include red flags, questions to ask, and what high-net-worth business owners should expect from a modern advisor.'
  },
  {
    title: 'Captives 101: A Complete Guide for High-Margin Business Owners',
    category: 'strategy',
    focus: 'Comprehensive guide to captive insurance for business owners. Cover what captives are, how they work, who qualifies ($5M+ revenue, specific risk profiles), tax benefits, setup process, and ongoing management requirements.'
  }
];

async function generateArticle(spec: ArticleSpec): Promise<{ content: string; excerpt: string; readTime: string }> {
  console.log(`Generating article: ${spec.title}`);

  const prompt = `You are an expert financial content writer specializing in advanced tax strategies for high-net-worth business owners.

Write a comprehensive, authoritative article (1,200-1,500 words) on the following topic:

Title: ${spec.title}

Focus: ${spec.focus}

Target Audience: Business owners with $5M+ annual revenue who are looking to optimize their tax strategy and build wealth.

Requirements:
1. Use a professional but accessible tone
2. Include specific examples and scenarios
3. Break up content with clear section headers (use ## for h2, ### for h3)
4. Include actionable takeaways
5. Reference real strategies without giving specific legal/financial advice
6. Make the content SEO-friendly with natural keyword usage
7. End with a call-to-action encouraging readers to consult with a strategic advisor

Format the article with:
- Clear introduction explaining why this matters
- 3-5 main sections with headers
- Bullet points where appropriate
- Strong conclusion with next steps

Do NOT include the title in the content - it will be added separately.

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
  const excerptPrompt = `Write a compelling 2-sentence excerpt (150-200 characters) for this article that would make a business owner want to read more:

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
  console.log('Blog Content Generator');
  console.log('='.repeat(50));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  for (const spec of PILLAR_ARTICLES) {
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
  console.log('Content Generation Complete');
  console.log('='.repeat(50));
}

main();
