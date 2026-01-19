import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import { insertAdvisorSchema, insertLeadSchema, advisorSearchSchema, generateAdvisorSlug } from '../shared/schema';

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Strategic Advisor Hub'
      });
    } catch (error) {
      res.status(500).json({ status: 'ERROR', message: 'Health check failed' });
    }
  });

  // ============================================
  // ADVISOR ROUTES
  // ============================================

  // Search/list advisors
  app.get('/api/advisors', async (req, res) => {
    try {
      const searchParams = {
        city: req.query.city as string | undefined,
        state: req.query.state as string | undefined,
        zipCode: req.query.zipCode as string | undefined,
        designation: req.query.designation as any,
        query: req.query.query as string | undefined,
        isVerifiedStrategist: req.query.isVerifiedStrategist === 'true' ? true : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = advisorSearchSchema.safeParse(searchParams);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid search parameters', errors: result.error.format() });
      }

      const advisors = await storage.getAdvisors(result.data);
      res.json(advisors);
    } catch (error) {
      console.error('Error fetching advisors:', error);
      res.status(500).json({ message: 'Failed to fetch advisors' });
    }
  });

  // Get advisor by slug
  app.get('/api/advisors/slug/:slug', async (req, res) => {
    try {
      const advisor = await storage.getAdvisorBySlug(req.params.slug);
      if (!advisor) {
        return res.status(404).json({ message: 'Advisor not found' });
      }
      res.json(advisor);
    } catch (error) {
      console.error('Error fetching advisor:', error);
      res.status(500).json({ message: 'Failed to fetch advisor' });
    }
  });

  // Get advisor by ID
  app.get('/api/advisors/:id', async (req, res) => {
    try {
      const advisor = await storage.getAdvisorById(req.params.id);
      if (!advisor) {
        return res.status(404).json({ message: 'Advisor not found' });
      }
      res.json(advisor);
    } catch (error) {
      console.error('Error fetching advisor:', error);
      res.status(500).json({ message: 'Failed to fetch advisor' });
    }
  });

  // Create advisor
  app.post('/api/advisors', async (req, res) => {
    try {
      let data = { ...req.body };

      // Auto-generate slug if not provided
      if (!data.slug && data.name && data.city) {
        data.slug = generateAdvisorSlug(data.name, data.city, data.specialties?.[0]);
      }

      const result = insertAdvisorSchema.safeParse(data);
      if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.format() });
      }

      const advisor = await storage.createAdvisor(result.data);
      res.status(201).json(advisor);
    } catch (error: any) {
      console.error('Error creating advisor:', error);
      if (error.code === '23505') {
        return res.status(409).json({ message: 'An advisor with this slug already exists' });
      }
      res.status(500).json({ message: 'Failed to create advisor' });
    }
  });

  // Update advisor
  app.patch('/api/advisors/:id', async (req, res) => {
    try {
      const advisor = await storage.updateAdvisor(req.params.id, req.body);
      res.json(advisor);
    } catch (error) {
      console.error('Error updating advisor:', error);
      res.status(500).json({ message: 'Failed to update advisor' });
    }
  });

  // ============================================
  // LEAD ROUTES
  // ============================================

  // Create lead
  app.post('/api/leads', async (req, res) => {
    try {
      const result = insertLeadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.format() });
      }

      // Verify advisor exists
      const advisor = await storage.getAdvisorById(result.data.advisorId);
      if (!advisor) {
        return res.status(404).json({ message: 'Advisor not found' });
      }

      const lead = await storage.createLead(result.data);
      console.log(`New lead: ${lead.userName} from ${lead.sourcePage} (${lead.sourceType})`);

      res.status(201).json({
        success: true,
        message: "Thank you! We'll be in touch shortly.",
        leadId: lead.id
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ message: 'Failed to submit. Please try again.' });
    }
  });

  // Get leads by advisor
  app.get('/api/advisors/:id/leads', async (req, res) => {
    try {
      const leads = await storage.getLeadsByAdvisor(req.params.id);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  });

  // Get all leads
  app.get('/api/leads', async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  });

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // Health/stats endpoint
  app.get('/api/admin/stats', async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        stats: {
          totalAdvisors: stats.totalAdvisors,
          leadsToday: stats.leadsToday,
          totalLeads: stats.totalLeads,
        },
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to fetch stats' });
    }
  });

  // ============================================
  // SEO ROUTES
  // ============================================

  // Dynamic XML Sitemap
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const advisorSlugs = await storage.getAllAdvisorSlugs();
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const baseUrl = `${protocol}://${req.get('host')}`;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/search</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${advisorSlugs.map(({ slug, updatedAt }) => `  <url>
    <loc>${baseUrl}/advisor/${slug}</loc>
    <lastmod>${updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      console.error('Error generating sitemap:', error);
      res.status(500).send('Failed to generate sitemap');
    }
  });

  // SEO meta data for advisor
  app.get('/api/seo/advisor/:slug', async (req, res) => {
    try {
      const advisor = await storage.getAdvisorBySlug(req.params.slug);
      if (!advisor) {
        return res.status(404).json({ message: 'Advisor not found' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const baseUrl = `${protocol}://${req.get('host')}`;
      const title = `${advisor.name} - Strategic ${advisor.designation} in ${advisor.city} | Wealth Advisor Hub`;
      const description = advisor.bio
        ? advisor.bio.substring(0, 155) + '...'
        : `Connect with ${advisor.name}, a strategic ${advisor.designation} in ${advisor.city}, ${advisor.state}. Specializing in ${advisor.specialties?.slice(0, 3).join(', ') || 'tax planning and wealth management'}.`;

      res.json({
        title,
        description,
        canonical: `${baseUrl}/advisor/${advisor.slug}`,
        ogType: 'profile',
        structuredData: {
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
        }
      });
    } catch (error) {
      console.error('Error generating SEO data:', error);
      res.status(500).json({ message: 'Failed to generate SEO data' });
    }
  });

  return httpServer;
}
