import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Search, Shield, TrendingUp, Users, MapPin, ArrowRight } from 'lucide-react';

interface CityData {
  city: string;
  state: string;
  slug: string;
  count: number;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [designation, setDesignation] = useState('');

  // Fetch top cities for Browse Directory section
  const { data: topCities } = useQuery<CityData[]>({
    queryKey: ['top-cities'],
    queryFn: async () => {
      const res = await fetch('/api/directory/top-cities');
      if (!res.ok) throw new Error('Failed to fetch cities');
      return res.json();
    },
  });

  // Add canonical tag for homepage
  useEffect(() => {
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', window.location.origin);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('query', searchQuery);
    if (designation) params.set('designation', designation);
    setLocation(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-400" />
            <span className="text-xl font-bold tracking-tight">The Alpha Directory</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/search" className="hover:text-amber-400 transition-colors">Find Advisors</a>
            <a href="/blog" className="hover:text-amber-400 transition-colors">Financial Journal</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-full mb-6">
            <span className="text-amber-400 font-medium text-sm">Connecting Business Owners with Strategic CPAs and Wealth Managers</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Find Your Alpha Advisor<br />
            <span className="text-amber-400">Who Thinks Bigger</span>
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Connect with verified CPAs and Wealth Managers who specialize in proactive tax strategies,
            reinsurance domiciles, and building multi-generational wealth.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="bg-white rounded-lg p-2 shadow-xl max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="City, ZIP, or advisor name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-slate-900 rounded-md border-0 focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="px-4 py-3 text-slate-900 rounded-md border border-slate-200 focus:ring-2 focus:ring-navy-500"
              >
                <option value="">All Professions</option>
                <option value="CPA">CPA</option>
                <option value="Wealth Manager">Wealth Manager</option>
                <option value="CPA & Wealth Manager">CPA & Wealth Manager</option>
              </select>
              <button
                type="submit"
                className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-12">
            Why Choose a Strategic Partner?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-navy-900 mb-2">Proactive Tax Strategies</h3>
              <p className="text-slate-600">
                Go beyond compliance. Our strategic partners use advanced techniques like captive insurance
                and reinsurance domiciles to legally minimize your tax burden.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-navy-900 mb-2">Verified Expertise</h3>
              <p className="text-slate-600">
                Our Strategic Partner badge identifies advisors with proven track records
                in advanced wealth preservation and tax optimization strategies.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-navy-900 mb-2">High-Net-Worth Focus</h3>
              <p className="text-slate-600">
                These advisors specialize in serving business owners, executives, and families
                with complex financial situations requiring sophisticated solutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Browse Directory - Internal Linking for SEO */}
      {topCities && topCities.length > 0 && (
        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-navy-900 mb-4">
                Browse Strategic Advisors by Location
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Find CPAs and Wealth Managers specializing in 831(b) captives, reinsurance, and proactive tax strategies in your city.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {topCities.map((city) => (
                <a
                  key={city.slug}
                  href={`/directory/location/${city.slug}`}
                  className="group bg-white rounded-lg border border-slate-200 p-4 hover:border-navy-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-navy-900 group-hover:text-amber-600 transition-colors">
                      {city.city}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{city.state}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {city.count} advisor{city.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </a>
              ))}
            </div>
            <div className="text-center mt-8">
              <a
                href="/search"
                className="inline-flex items-center gap-2 text-navy-600 hover:text-navy-800 font-medium"
              >
                View All Locations
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-4 bg-navy-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Is Your Current Advisor Leaving Money on the Table?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Most advisors focus on compliance. Strategic partners focus on optimization.
          </p>
          <a
            href="/search?isVerifiedStrategist=true"
            className="inline-block px-8 py-4 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors"
          >
            Find Strategic Partners Near You
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-amber-400" />
            <span className="text-lg font-semibold text-white">The Alpha Directory</span>
          </div>
          <p className="text-sm">
            © 2024 The Alpha Directory. Connecting business owners with strategic financial advisors.
          </p>
        </div>
      </footer>
    </div>
  );
}
