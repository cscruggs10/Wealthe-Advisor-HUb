import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, ArrowRight, Newspaper } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  readTime: string;
  createdAt: string;
}

export default function BlogPage() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const res = await fetch('/api/blog');
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
  });

  const categoryLabels: Record<string, string> = {
    strategy: 'Tax Strategy',
    tax: 'Tax Planning',
    wealth: 'Wealth Management',
  };

  const categoryColors: Record<string, string> = {
    strategy: 'bg-amber-100 text-amber-800 border border-amber-200',
    tax: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    wealth: 'bg-blue-100 text-blue-800 border border-blue-200',
  };

  return (
    <div className="min-h-screen bg-stone-50">
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

      {/* Hero - Financial Journal Aesthetic */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="h-px w-12 bg-amber-500"></div>
            <Newspaper className="h-5 w-5 text-amber-600" />
            <div className="h-px w-12 bg-amber-500"></div>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4 tracking-tight">
            The Financial Journal
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto font-light leading-relaxed">
            Expert insights on reinsurance, captive insurance, and advanced tax strategies
            for high-net-worth business owners seeking alpha in their financial planning.
          </p>
        </div>
      </div>

      {/* Blog Posts */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-navy-900 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading articles...</p>
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-8">
            {posts.map((post, index) => (
              <article
                key={post.id}
                className={`bg-white border border-stone-200 overflow-hidden hover:shadow-md transition-shadow ${index === 0 ? 'rounded-lg' : 'rounded-lg'}`}
              >
                <a href={`/blog/${post.slug}`} className="block p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${categoryColors[post.category] || 'bg-stone-100 text-stone-700'}`}>
                      {categoryLabels[post.category] || post.category}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-stone-500">
                      <Clock className="h-4 w-4" />
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-navy-900 mb-3 hover:text-amber-700 transition-colors leading-tight">
                    {post.title}
                  </h2>
                  <p className="text-stone-600 mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 text-amber-600 font-medium">
                    Continue Reading
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Newspaper className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-stone-700 mb-2">No articles yet</h2>
            <p className="text-stone-500">
              Check back soon for expert insights on tax strategy and wealth building.
            </p>
          </div>
        )}
      </main>

      {/* CTA Section */}
      <section className="bg-navy-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-serif font-bold mb-4">
            Ready to Find Your Alpha Advisor?
          </h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            Connect with strategic CPAs and wealth managers who specialize in advanced tax structures for high-net-worth business owners.
          </p>
          <a
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-3 bg-amber-500 text-navy-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            Find an Alpha Advisor
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>
    </div>
  );
}
