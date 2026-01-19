import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, ArrowRight, BookOpen } from 'lucide-react';

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
    strategy: 'bg-amber-100 text-amber-800',
    tax: 'bg-emerald-100 text-emerald-800',
    wealth: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-400" />
            <span className="text-xl font-bold">Wealth Advisor Hub</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/search" className="text-slate-300 hover:text-white transition-colors">
              Find Advisors
            </a>
            <a href="/blog" className="text-emerald-400 font-medium">
              Insights
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-navy-800/50 px-4 py-2 rounded-full mb-6">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Strategic Insights</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Tax Strategy & Wealth Building
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Expert insights on reinsurance, captive insurance, and advanced tax strategies for high-net-worth business owners.
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
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <a href={`/blog/${post.slug}`} className="block p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${categoryColors[post.category] || 'bg-slate-100 text-slate-700'}`}>
                      {categoryLabels[post.category] || post.category}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="h-4 w-4" />
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-navy-900 mb-3 hover:text-navy-700 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    Read Article
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No articles yet</h2>
            <p className="text-slate-500">
              Check back soon for expert insights on tax strategy and wealth building.
            </p>
          </div>
        )}
      </main>

      {/* CTA Section */}
      <section className="bg-navy-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Optimize Your Tax Strategy?
          </h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            Connect with verified strategic advisors who specialize in advanced tax structures for high-net-worth business owners.
          </p>
          <a
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Find a Strategic Advisor
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>
    </div>
  );
}
