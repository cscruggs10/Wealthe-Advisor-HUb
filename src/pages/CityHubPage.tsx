import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Shield, MapPin, Award, ArrowLeft, Star, Users, Briefcase } from 'lucide-react';
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

interface SpecialtyLink {
  specialty: string;
  slug: string;
  count: number;
}

interface CityHubData {
  city: string;
  state: string;
  slug: string;
  advisorCount: number;
  advisors: Advisor[];
  specialties: SpecialtyLink[];
}

function hasStrategicSpecialty(specialties: string[] | null): boolean {
  if (!specialties) return false;
  return specialties.some(s => {
    const lower = s.toLowerCase();
    return lower.includes('tax strategy') || lower.includes('reinsurance') || lower.includes('captive');
  });
}

export default function CityHubPage() {
  const [, params] = useRoute('/directory/location/:city');
  const citySlug = params?.city;

  const { data, isLoading, error } = useQuery<CityHubData>({
    queryKey: ['city-hub', citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/directory/location/${citySlug}`);
      if (!res.ok) throw new Error('City not found');
      return res.json();
    },
    enabled: !!citySlug,
  });

  // Inject JSON-LD structured data and meta tags
  useEffect(() => {
    if (!data) return;

    const pageTitle = `Top Strategic CPAs & Wealth Advisors in ${data.city}, ${data.state}`;
    const metaDescription = `Find the best strategic CPAs and Wealth Managers in ${data.city}, ${data.state}. ${data.advisorCount} verified professionals specializing in 831(b) captives, reinsurance, and tax planning for business owners.`;

    // Collection Page schema
    const collectionSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": pageTitle,
      "description": metaDescription,
      "url": window.location.href,
      "numberOfItems": data.advisorCount,
      "spatialCoverage": {
        "@type": "City",
        "name": data.city,
        "containedInPlace": {
          "@type": "State",
          "name": data.state
        }
      },
      "provider": {
        "@type": "Organization",
        "name": "The Alpha Directory",
        "url": window.location.origin
      }
    };

    // Breadcrumb schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": window.location.origin
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Directory",
          "item": `${window.location.origin}/search`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": `${data.city}, ${data.state}`,
          "item": window.location.href
        }
      ]
    };

    // Remove existing scripts
    document.getElementById('city-hub-jsonld')?.remove();
    document.getElementById('breadcrumb-jsonld')?.remove();

    // Add collection schema
    const collectionScript = document.createElement('script');
    collectionScript.type = 'application/ld+json';
    collectionScript.text = JSON.stringify(collectionSchema);
    collectionScript.id = 'city-hub-jsonld';
    document.head.appendChild(collectionScript);

    // Add breadcrumb schema
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.text = JSON.stringify(breadcrumbSchema);
    breadcrumbScript.id = 'breadcrumb-jsonld';
    document.head.appendChild(breadcrumbScript);

    // Update page title
    document.title = pageTitle;

    // Update meta description
    let metaTag = document.querySelector('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'description');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', metaDescription);

    // Add canonical tag
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', `${window.location.origin}/directory/location/${data.slug}`);

    return () => {
      document.getElementById('city-hub-jsonld')?.remove();
      document.getElementById('breadcrumb-jsonld')?.remove();
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
          <h1 className="text-2xl font-bold text-slate-700 mb-2">City Not Found</h1>
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
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-6 w-6 text-amber-400" />
            <span className="text-amber-400 font-medium">{data.state}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Strategic CPAs & Wealth Advisors in {data.city}
          </h1>
          <p className="text-xl text-slate-300 mb-6">
            Connect with {data.advisorCount} verified financial professionals in {data.city}, {data.state} specializing in tax strategy and wealth management.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              <span>{data.advisorCount} Advisors</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-amber-400" />
              <span>{data.specialties.length} Specialties</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar - Specialty Links */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-4">
              <h3 className="text-lg font-bold text-navy-900 mb-4">
                Specialties in {data.city}
              </h3>
              <div className="space-y-2">
                {data.specialties.slice(0, 12).map((spec) => (
                  <a
                    key={spec.slug}
                    href={`/directory/${spec.slug}/${data.slug}`}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-slate-700 text-sm">{spec.specialty}</span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                      {spec.count}
                    </span>
                  </a>
                ))}
              </div>
              {data.specialties.length > 12 && (
                <p className="text-sm text-slate-500 mt-4 text-center">
                  +{data.specialties.length - 12} more specialties
                </p>
              )}
            </div>
          </div>

          {/* Main Content - Advisors */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <h2 className="text-xl font-bold text-navy-900 mb-4">
              Top Advisors in {data.city}, {data.state}
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
                        {advisor.city}, {advisor.state}
                      </div>
                      {advisor.specialties && advisor.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {advisor.specialties.slice(0, 4).map((spec, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
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

            {data.advisors.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No advisors found</h3>
                <p className="text-slate-500 mb-4">
                  We're still building our network in {data.city}.
                </p>
                <a
                  href="/search"
                  className="inline-block px-6 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800"
                >
                  Browse All Advisors
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
