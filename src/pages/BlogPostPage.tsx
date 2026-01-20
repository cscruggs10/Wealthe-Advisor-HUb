import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Shield, Clock, ArrowLeft, Star, MapPin, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: string;
  createdAt: string;
}

interface Advisor {
  id: string;
  name: string;
  designation: string;
  city: string;
  state: string;
  slug: string;
  specialties: string[] | null;
}

export default function BlogPostPage() {
  const [, params] = useRoute('/blog/:slug');
  const slug = params?.slug;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}`);
      if (!res.ok) throw new Error('Post not found');
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: featuredAdvisors } = useQuery<Advisor[]>({
    queryKey: ['featured-strategists'],
    queryFn: async () => {
      const res = await fetch('/api/strategists/featured');
      if (!res.ok) throw new Error('Failed to fetch advisors');
      return res.json();
    },
  });

  // Inject JSON-LD for blog post
  useEffect(() => {
    if (!post) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.excerpt,
      "datePublished": post.createdAt,
      "publisher": {
        "@type": "Organization",
        "name": "Wealth Advisor Hub"
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(jsonLd);
    script.id = 'blog-jsonld';

    const existing = document.getElementById('blog-jsonld');
    if (existing) existing.remove();

    document.head.appendChild(script);

    return () => {
      const toRemove = document.getElementById('blog-jsonld');
      if (toRemove) toRemove.remove();
    };
  }, [post]);

  const categoryLabels: Record<string, string> = {
    strategy: 'Tax Strategy',
    tax: 'Tax Planning',
    wealth: 'Wealth Management',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-navy-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Article Not Found</h1>
          <a href="/blog" className="text-navy-600 hover:underline">
            ← Back to Blog
          </a>
        </div>
      </div>
    );
  }

  // Convert markdown-style content to HTML
  const formatContent = (content: string) => {
    return content
      .split('\n\n')
      .map((paragraph, i) => {
        // Headers
        if (paragraph.startsWith('## ')) {
          return `<h2 class="text-2xl font-bold text-navy-900 mt-8 mb-4">${paragraph.slice(3)}</h2>`;
        }
        if (paragraph.startsWith('### ')) {
          return `<h3 class="text-xl font-semibold text-navy-900 mt-6 mb-3">${paragraph.slice(4)}</h3>`;
        }
        // Bullet lists
        if (paragraph.includes('\n- ')) {
          const items = paragraph.split('\n- ').filter(Boolean);
          return `<ul class="list-disc list-inside space-y-2 my-4 text-slate-700">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        }
        // Regular paragraphs
        return `<p class="text-slate-700 leading-relaxed my-4">${paragraph}</p>`;
      })
      .join('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-400" />
            <span className="text-xl font-bold tracking-tight">The Alpha Directory</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/search" className="text-slate-300 hover:text-white transition-colors">
              Find Advisors
            </a>
            <a href="/blog" className="text-amber-400 font-medium">
              Financial Journal
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <a href="/blog" className="inline-flex items-center gap-1 text-slate-600 hover:text-navy-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </a>

        {/* Article Header */}
        <article className="bg-white rounded-xl border border-slate-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
              {categoryLabels[post.category] || post.category}
            </span>
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">
            {post.title}
          </h1>

          <p className="text-xl text-slate-600 mb-8 border-b border-slate-200 pb-8">
            {post.excerpt}
          </p>

          {/* Article Content */}
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: formatContent(post.content) }}
          />
        </article>

        {/* Featured Alpha Advisors Section */}
        {featuredAdvisors && featuredAdvisors.length > 0 && (
          <section className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-xl p-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
              <h2 className="text-2xl font-serif font-bold">Featured Alpha Advisors</h2>
            </div>
            <p className="text-slate-300 mb-6">
              Connect with strategic advisors who specialize in the strategies discussed in this article.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {featuredAdvisors.map((advisor) => (
                <a
                  key={advisor.id}
                  href={`/advisor/${advisor.slug}`}
                  className="bg-white/10 backdrop-blur rounded-lg p-4 hover:bg-white/20 transition-colors border border-amber-500/20"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 font-bold text-sm">
                      {advisor.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{advisor.name}</h3>
                      <p className="text-xs text-slate-300">{advisor.designation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3 w-3" />
                    {advisor.city}, {advisor.state}
                  </div>
                  {advisor.specialties && advisor.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {advisor.specialties.slice(0, 2).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-amber-500/20 rounded text-amber-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              ))}
            </div>

            <a
              href="/search"
              className="inline-flex items-center gap-2 text-amber-400 font-medium hover:text-amber-300 transition-colors"
            >
              View All Alpha Advisors
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
