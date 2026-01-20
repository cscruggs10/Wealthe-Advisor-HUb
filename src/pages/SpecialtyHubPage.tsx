import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Shield, MapPin, Award, ArrowLeft, Star, Users, Building2 } from 'lucide-react';
import { useEffect } from 'react';

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
}

interface CityLink {
  city: string;
  state: string;
  slug: string;
  count: number;
}

interface SpecialtyHubData {
  specialty: string;
  slug: string;
  advisorCount: number;
  advisors: Advisor[];
  cities: CityLink[];
}

function hasStrategicSpecialty(specialties: string[] | null): boolean {
  if (!specialties) return false;
  return specialties.some(s => {
    const lower = s.toLowerCase();
    return lower.includes('tax strategy') || lower.includes('reinsurance') || lower.includes('captive');
  });
}

export default function SpecialtyHubPage() {
  const [, params] = useRoute('/directory/:specialty');
  const specialty = params?.specialty;

  const { data, isLoading, error } = useQuery<SpecialtyHubData>({
    queryKey: ['specialty-hub', specialty],
    queryFn: async () => {
      const res = await fetch(`/api/directory/specialty/${specialty}`);
      if (!res.ok) throw new Error('Specialty not found');
      return res.json();
    },
    enabled: !!specialty,
  });

  // Inject JSON-LD structured data
  useEffect(() => {
    if (!data) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${data.specialty} Advisors | The Alpha Directory`,
      "description": `Find top ${data.specialty} advisors and CPAs. ${data.advisorCount} verified professionals ready to help with your ${data.specialty.toLowerCase()} needs.`,
      "url": window.location.href,
      "numberOfItems": data.advisorCount,
      "provider": {
        "@type": "Organization",
        "name": "The Alpha Directory"
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(jsonLd);
    script.id = 'specialty-hub-jsonld';

    const existing = document.getElementById('specialty-hub-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);

    // Update page title
    document.title = `${data.specialty} Advisors | The Alpha Directory`;

    return () => {
      const toRemove = document.getElementById('specialty-hub-jsonld');
      if (toRemove) toRemove.remove();
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-navy-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Specialty Not Found</h1>
          <a href="/search" className="text-navy-600 hover:underline">
            ← Back to Search
          </a>
        </div>
      </div>
    );
  }

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
            <a href="/search" className="text-slate-300 hover:text-white transition-colors">Find Advisors</a>
            <a href="/blog" className="text-slate-300 hover:text-white transition-colors">Financial Journal</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <a href="/search" className="inline-flex items-center gap-1 text-slate-300 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" />
            All Advisors
          </a>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {data.specialty} Advisors
          </h1>
          <p className="text-xl text-slate-300 mb-6">
            Connect with {data.advisorCount} verified {data.specialty.toLowerCase()} professionals across the United States.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              <span>{data.advisorCount} Advisors</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-400" />
              <span>{data.cities.length} Cities</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content - Advisors */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-bold text-navy-900 mb-4">
              Top {data.specialty} Advisors
            </h2>
            <div className="space-y-4">
              {data.advisors.map((advisor) => (
                <a
                  key={advisor.id}
                  href={`/advisor/${advisor.slug}`}
                  className="block bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-semibold text-navy-900">{advisor.name}</h3>
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
                        <a
                          href={`/directory/${data.slug}/${advisor.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${advisor.state.toLowerCase()}`}
                          className="hover:text-navy-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {advisor.city}, {advisor.state}
                        </a>
                      </div>
                      {advisor.specialties && advisor.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {advisor.specialties.slice(0, 4).map((spec, i) => (
                            <span
                              key={i}
                              className={`px-2 py-1 text-xs rounded ${
                                spec.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === data.slug
                                  ? 'bg-amber-100 text-amber-800 font-medium'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {spec}
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
          </div>

          {/* Sidebar - City Links */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-4">
              <h3 className="text-lg font-bold text-navy-900 mb-4">
                {data.specialty} by City
              </h3>
              <div className="space-y-2">
                {data.cities.slice(0, 15).map((city) => (
                  <a
                    key={city.slug}
                    href={`/directory/${data.slug}/${city.slug}`}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-slate-700">{city.city}, {city.state}</span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                      {city.count}
                    </span>
                  </a>
                ))}
              </div>
              {data.cities.length > 15 && (
                <p className="text-sm text-slate-500 mt-4 text-center">
                  +{data.cities.length - 15} more cities
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
