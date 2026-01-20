import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { Server } from 'http';
import { storage } from './storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bot detection for SEO logging
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /linkedinbot/i, /facebookexternalhit/i,
  /twitterbot/i, /whatsapp/i, /slackbot/i, /telegrambot/i,
];

function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

// Generate SEO meta tags for advisor pages
async function generateAdvisorMetaTags(slug: string, baseUrl: string): Promise<string | null> {
  try {
    const advisor = await storage.getAdvisorBySlug(slug);
    if (!advisor) return null;

    const title = `${advisor.name} - Strategic ${advisor.designation} in ${advisor.city} | Wealth Advisor Hub`;
    const description = advisor.bio
      ? advisor.bio.substring(0, 155) + '...'
      : `Connect with ${advisor.name}, a strategic ${advisor.designation} in ${advisor.city}, ${advisor.state}.`;

    const canonicalUrl = `${baseUrl}/advisor/${advisor.slug}`;

    return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="Wealth Advisor Hub" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": advisor.name,
      "description": description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": advisor.city,
        "addressRegion": advisor.state,
        "postalCode": advisor.zipCode,
        "addressCountry": "US"
      }
    })}</script>
    `;
  } catch (error) {
    console.error('Error generating meta tags:', error);
    return null;
  }
}

function extractAdvisorSlug(url: string): string | null {
  const match = url.match(/^\/advisor\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    const userAgent = req.headers['user-agent'] || '';
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    try {
      let template = await fs.promises.readFile(
        path.resolve(__dirname, '..', 'index.html'),
        'utf-8'
      );

      // Inject SEO meta tags for advisor pages
      const advisorSlug = extractAdvisorSlug(url);
      if (advisorSlug) {
        if (isBot(userAgent)) {
          console.log(`[SEO] Bot detected crawling /advisor/${advisorSlug}`);
        }
        const metaTags = await generateAdvisorMetaTags(advisorSlug, baseUrl);
        if (metaTags) {
          template = template.replace(/<title>.*?<\/title>/, '');
          template = template.replace('</head>', `${metaTags}\n</head>`);
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, the bundled server and static files are in the same directory
  const distPath = __dirname;

  if (!fs.existsSync(path.join(distPath, 'index.html'))) {
    throw new Error(`Build directory not found: ${distPath}`);
  }

  app.use(express.static(distPath));

  // Catch-all route for SPA - must be after static middleware
  app.get('*', async (req, res) => {
    const url = req.originalUrl;
    const userAgent = req.headers['user-agent'] || '';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const indexPath = path.resolve(distPath, 'index.html');

    try {
      let html = await fs.promises.readFile(indexPath, 'utf-8');

      const advisorSlug = extractAdvisorSlug(url);
      if (advisorSlug) {
        if (isBot(userAgent)) {
          console.log(`[SEO] Bot detected crawling /advisor/${advisorSlug}`);
        }
        const metaTags = await generateAdvisorMetaTags(advisorSlug, baseUrl);
        if (metaTags) {
          html = html.replace(/<title>.*?<\/title>/, '');
          html = html.replace('</head>', `${metaTags}\n</head>`);
        }
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      console.error('Error serving HTML:', error);
      res.sendFile(indexPath);
    }
  });
}
