import { useQuery } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { Search, Shield, MapPin, Award, ArrowLeft, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

// Check if advisor has strategic specialties (Tax Strategy or Reinsurance)
function hasStrategicSpecialty(specialties: string[] | null): boolean {
  if (!specialties) return false;
  return specialties.some(s => {
    const lower = s.toLowerCase();
    return lower.includes('tax strategy') ||
           lower.includes('reinsurance') ||
           lower.includes('captive');
  });
}

interface Advisor {
  id: string;
  name: string;
  firmName: string | null;
  designation: string;
  city: string;
  state: string;
  specialties: string[] | null;
  isVerifiedStrategist: boolean;
  slug: string;
  bio: string | null;
}

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState(params.get('query') || '');
  const [designation, setDesignation] = useState(params.get('designation') || '');

  const { data: advisors, isLoading } = useQuery<Advisor[]>({
    queryKey: ['advisors', searchString],
    queryFn: async () => {
      const res = await fetch(`/api/advisors?${searchString}`);
      if (!res.ok) throw new Error('Failed to fetch advisors');
      return res.json();
    },
  });

  // Add canonical tag for search page (without query params to avoid duplicate content)
  useEffect(() => {
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', `${window.location.origin}/search`);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams();
    if (query) newParams.set('query', query);
    if (designation) newParams.set('designation', designation);
    setLocation(`/search?${newParams.toString()}`);
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
            <a href="/search" className="text-amber-400 font-medium">Find Advisors</a>
            <a href="/blog" className="text-slate-300 hover:text-white transition-colors">Financial Journal</a>
          </nav>
        </div>
      </header>

      {/* Search Bar */}
      <div className="bg-white border-b border-slate-200 py-4 px-4">
        <form onSubmit={handleSearch} className="max-w-4xl mx-auto flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="City, ZIP, or advisor name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
          <select
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-navy-500"
          >
            <option value="">All Professions</option>
            <option value="CPA">CPA</option>
            <option value="Wealth Manager">Wealth Manager</option>
            <option value="CPA & Wealth Manager">CPA & Wealth Manager</option>
          </select>
          <button
            type="submit"
            className="px-6 py-2 bg-navy-900 text-white font-medium rounded-md hover:bg-navy-800 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-slate-600 hover:text-navy-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </a>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-navy-900 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-slate-600">Finding advisors...</p>
          </div>
        ) : advisors && advisors.length > 0 ? (
          <>
            <h1 className="text-2xl font-bold text-navy-900 mb-6">
              {advisors.length} Advisor{advisors.length !== 1 ? 's' : ''} Found
            </h1>
            <div className="space-y-4">
              {advisors.map((advisor) => (
                <a
                  key={advisor.id}
                  href={`/advisor/${advisor.slug}`}
                  className="block bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-semibold text-navy-900">{advisor.name}</h2>
                        {hasStrategicSpecialty(advisor.specialties) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Verified Strategist
                          </span>
                        )}
                        {advisor.isVerifiedStrategist && !hasStrategicSpecialty(advisor.specialties) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            <Award className="h-3 w-3" />
                            Strategic Partner
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mb-2">
                        {advisor.designation}
                        {advisor.firmName && ` • ${advisor.firmName}`}
                      </p>
                      <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                        <MapPin className="h-4 w-4" />
                        {advisor.city}, {advisor.state}
                      </div>
                      {advisor.specialties && advisor.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {advisor.specialties.slice(0, 4).map((specialty, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-navy-600 font-medium text-sm">
                      View Profile →
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No advisors found</h2>
            <p className="text-slate-500">
              Try adjusting your search criteria or browse all advisors.
            </p>
            <a
              href="/search"
              className="inline-block mt-4 px-6 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800"
            >
              View All Advisors
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
