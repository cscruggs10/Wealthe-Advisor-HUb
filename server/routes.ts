import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import { insertAdvisorSchema, insertLeadSchema, advisorSearchSchema, generateAdvisorSlug, insertBlogPostSchema } from '../shared/schema';

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
  // BLOG ROUTES
  // ============================================

  // Get all blog posts
  app.get('/api/blog', async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ message: 'Failed to fetch blog posts' });
    }
  });

  // Get blog post by slug
  app.get('/api/blog/:slug', async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      res.json(post);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ message: 'Failed to fetch blog post' });
    }
  });

  // Get random strategists for featured section
  app.get('/api/strategists/featured', async (_req, res) => {
    try {
      const strategists = await storage.getRandomStrategists(3);
      res.json(strategists);
    } catch (error) {
      console.error('Error fetching strategists:', error);
      res.status(500).json({ message: 'Failed to fetch strategists' });
    }
  });

  // Create blog post (admin)
  app.post('/api/blog', async (req, res) => {
    try {
      const result = insertBlogPostSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.format() });
      }

      const post = await storage.createBlogPost(result.data);
      res.status(201).json(post);
    } catch (error: any) {
      console.error('Error creating blog post:', error);
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A blog post with this slug already exists' });
      }
      res.status(500).json({ message: 'Failed to create blog post' });
    }
  });

  // ============================================
  // pSEO DIRECTORY ROUTES
  // ============================================

  // Get all specialties (for directory index)
  app.get('/api/directory/specialties', async (_req, res) => {
    try {
      const specialties = await storage.getUniqueSpecialties();
      res.json(specialties);
    } catch (error) {
      console.error('Error fetching specialties:', error);
      res.status(500).json({ message: 'Failed to fetch specialties' });
    }
  });

  // Get all cities (for directory index)
  app.get('/api/directory/cities', async (_req, res) => {
    try {
      const cities = await storage.getUniqueCities();
      res.json(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ message: 'Failed to fetch cities' });
    }
  });

  // Get specialty hub data
  app.get('/api/directory/specialty/:slug', async (req, res) => {
    try {
      const specialtyInfo = await storage.getSpecialtyFromSlug(req.params.slug);
      if (!specialtyInfo) {
        return res.status(404).json({ message: 'Specialty not found' });
      }
      const advisors = await storage.getAdvisorsBySpecialty(req.params.slug);
      const cities = await storage.getUniqueCities();
      // Filter cities that have advisors with this specialty
      const relevantCities = cities.filter(city =>
        advisors.some(a =>
          `${a.city}-${a.state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === city.slug
        )
      );
      res.json({
        specialty: specialtyInfo.specialty,
        slug: req.params.slug,
        advisorCount: advisors.length,
        advisors,
        cities: relevantCities,
      });
    } catch (error) {
      console.error('Error fetching specialty hub:', error);
      res.status(500).json({ message: 'Failed to fetch specialty data' });
    }
  });

  // Get city hub data
  app.get('/api/directory/location/:slug', async (req, res) => {
    try {
      const cityInfo = await storage.getCityFromSlug(req.params.slug);
      if (!cityInfo) {
        return res.status(404).json({ message: 'City not found' });
      }
      const advisors = await storage.getAdvisorsByCity(req.params.slug);
      const specialties = await storage.getUniqueSpecialties();
      // Filter specialties that have advisors in this city
      const relevantSpecialties = specialties.filter(spec =>
        advisors.some(a =>
          a.specialties?.some(s =>
            s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === spec.slug
          )
        )
      );
      res.json({
        city: cityInfo.city,
        state: cityInfo.state,
        slug: req.params.slug,
        advisorCount: advisors.length,
        advisors,
        specialties: relevantSpecialties,
      });
    } catch (error) {
      console.error('Error fetching city hub:', error);
      res.status(500).json({ message: 'Failed to fetch city data' });
    }
  });

  // Get golden page data (specialty + city)
  app.get('/api/directory/:specialty/:city', async (req, res) => {
    try {
      const specialtyInfo = await storage.getSpecialtyFromSlug(req.params.specialty);
      const cityInfo = await storage.getCityFromSlug(req.params.city);

      if (!specialtyInfo || !cityInfo) {
        return res.status(404).json({ message: 'Page not found' });
      }

      const advisors = await storage.getAdvisorsBySpecialtyAndCity(req.params.specialty, req.params.city);

      res.json({
        specialty: specialtyInfo.specialty,
        specialtySlug: req.params.specialty,
        city: cityInfo.city,
        state: cityInfo.state,
        citySlug: req.params.city,
        advisorCount: advisors.length,
        advisors,
      });
    } catch (error) {
      console.error('Error fetching golden page:', error);
      res.status(500).json({ message: 'Failed to fetch page data' });
    }
  });

  // Get all directory routes for sitemap
  app.get('/api/directory/sitemap-data', async (_req, res) => {
    try {
      const specialties = await storage.getUniqueSpecialties();
      const cities = await storage.getUniqueCities();
      const goldenPages = await storage.getAllSpecialtyCityCombinations();
      res.json({ specialties, cities, goldenPages });
    } catch (error) {
      console.error('Error fetching sitemap data:', error);
      res.status(500).json({ message: 'Failed to fetch sitemap data' });
    }
  });

  // Get top cities for homepage directory browse
  app.get('/api/directory/top-cities', async (_req, res) => {
    try {
      const cities = await storage.getUniqueCities();
      // Return top 10 most populated cities
      res.json(cities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching top cities:', error);
      res.status(500).json({ message: 'Failed to fetch top cities' });
    }
  });

  // Get related locations for advisor profile (same state, different cities)
  app.get('/api/directory/related/:state', async (req, res) => {
    try {
      const cities = await storage.getUniqueCities();
      const relatedCities = cities
        .filter(c => c.state === req.params.state.toUpperCase())
        .slice(0, 6);
      res.json(relatedCities);
    } catch (error) {
      console.error('Error fetching related locations:', error);
      res.status(500).json({ message: 'Failed to fetch related locations' });
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
      const blogSlugs = await storage.getAllBlogSlugs();
      const specialties = await storage.getUniqueSpecialties();
      const cities = await storage.getUniqueCities();
      const goldenPages = await storage.getAllSpecialtyCityCombinations();
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const baseUrl = `${protocol}://${req.get('host')}`;
      const today = new Date().toISOString().split('T')[0];

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
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${blogSlugs.map(({ slug, updatedAt }) => `  <url>
    <loc>${baseUrl}/blog/${slug}</loc>
    <lastmod>${updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}
${advisorSlugs.map(({ slug, updatedAt }) => `  <url>
    <loc>${baseUrl}/advisor/${slug}</loc>
    <lastmod>${updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
${specialties.map(({ slug }) => `  <url>
    <loc>${baseUrl}/directory/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}
${cities.map(({ slug }) => `  <url>
    <loc>${baseUrl}/directory/location/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}
${goldenPages.map(({ specialtySlug, citySlug }) => `  <url>
    <loc>${baseUrl}/directory/${specialtySlug}/${citySlug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
</urlset>`;

      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send(xml);
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
