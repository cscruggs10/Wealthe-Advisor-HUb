import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { storage } from "./storage";

// SEO: Generate dynamic meta tags for advisor profile pages
async function generateAdvisorMetaTags(slug: string): Promise<string | null> {
  try {
    const advisor = await storage.getAdvisorBySlug(slug);
    if (!advisor) return null;

    const title = `${advisor.name} - ${advisor.designation} in ${advisor.city}, ${advisor.state} | Strategic Advisor Hub`;
    const description = advisor.bio
      ? advisor.bio.substring(0, 160)
      : `Find ${advisor.name}, a trusted ${advisor.designation} in ${advisor.city}, ${advisor.state}. ${advisor.specialties?.join(', ') || 'Tax planning, wealth management, and more.'}`;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": advisor.name,
      "description": description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": advisor.city,
        "addressRegion": advisor.state,
        "postalCode": advisor.zipCode
      },
      ...(advisor.websiteUrl && { "url": advisor.websiteUrl }),
      ...(advisor.linkedinUrl && { "sameAs": [advisor.linkedinUrl] }),
    };

    return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="/advisor/${advisor.slug}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="/advisor/${advisor.slug}" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    `;
  } catch (error) {
    console.error('Error generating advisor meta tags:', error);
    return null;
  }
}

// Extract slug from advisor profile URL
function extractAdvisorSlug(url: string): string | null {
  const match = url.match(/^\/advisor\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // SEO: Inject dynamic meta tags for advisor profile pages
      const advisorSlug = extractAdvisorSlug(url);
      if (advisorSlug) {
        const metaTags = await generateAdvisorMetaTags(advisorSlug);
        if (metaTags) {
          // Replace default meta tags with dynamic ones
          template = template.replace(
            /<title>.*?<\/title>/,
            '' // Remove default title, will be in metaTags
          );
          template = template.replace(
            '</head>',
            `${metaTags}\n  </head>`
          );
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // SEO: Inject dynamic meta tags for advisor profile pages in production
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");

    try {
      let html = await fs.promises.readFile(indexPath, "utf-8");

      // SEO: Inject dynamic meta tags for advisor profile pages
      const advisorSlug = extractAdvisorSlug(url);
      if (advisorSlug) {
        const metaTags = await generateAdvisorMetaTags(advisorSlug);
        if (metaTags) {
          // Replace default meta tags with dynamic ones
          html = html.replace(
            /<title>.*?<\/title>/,
            '' // Remove default title, will be in metaTags
          );
          html = html.replace(
            '</head>',
            `${metaTags}\n  </head>`
          );
        }
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      console.error('Error serving HTML:', error);
      res.sendFile(indexPath);
    }
  });
}
