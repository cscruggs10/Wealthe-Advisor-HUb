import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Shield, MapPin, Award, ArrowLeft, Star, Users, Phone, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

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

interface GoldenPageData {
  specialty: string;
  specialtySlug: string;
  city: string;
  state: string;
  citySlug: string;
  advisorCount: number;
  advisors: Advisor[];
}

function hasStrategicSpecialty(specialties: string[] | null): boolean {
  if (!specialties) return false;
  return specialties.some(s => {
    const lower = s.toLowerCase();
    return lower.includes('tax strategy') || lower.includes('reinsurance') || lower.includes('captive');
  });
}

export default function GoldenPage() {
  const [, params] = useRoute('/directory/:specialty/:city');
  const specialty = params?.specialty;
  const citySlug = params?.city;

  const { data, isLoading, error } = useQuery<GoldenPageData>({
    queryKey: ['golden-page', specialty, citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/directory/${specialty}/${citySlug}`);
      if (!res.ok) throw new Error('Page not found');
      return res.json();
    },
    enabled: !!specialty && !!citySlug,
  });

  // Inject JSON-LD structured data
  useEffect(() => {
    if (!data) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${data.specialty} Advisors in ${data.city}, ${data.state} | The Alpha Directory`,
      "description": `Find ${data.advisorCount} verified ${data.specialty.toLowerCase()} advisors in ${data.city}, ${data.state}. Connect with strategic CPAs and wealth managers specializing in ${data.specialty.toLowerCase()}.`,
      "url": window.location.href,
      "numberOfItems": data.advisorCount,
      "about": {
        "@type": "Service",
        "name": data.specialty,
        "areaServed": {
          "@type": "City",
          "name": data.city,
          "containedInPlace": {
            "@type": "State",
            "name": data.state
          }
        }
      },
      "provider": {
        "@type": "Organization",
        "name": "The Alpha Directory"
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(jsonLd);
    script.id = 'golden-page-jsonld';

    const existing = document.getElementById('golden-page-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);

    // Update page title
    document.title = `${data.specialty} Advisors in ${data.city}, ${data.state} | The Alpha Directory`;

    return () => {
      const toRemove = document.getElementById('golden-page-jsonld');
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
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Page Not Found</h1>
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

      {/* Hero Section - Premium Golden Page Design */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
            <a href="/search" className="hover:text-white">All Advisors</a>
            <span>/</span>
            <a href={`/directory/${data.specialtySlug}`} className="hover:text-white">{data.specialty}</a>
            <span>/</span>
            <a href={`/directory/location/${data.citySlug}`} className="hover:text-white">{data.city}, {data.state}</a>
          </nav>

          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 text-sm font-medium">
              {data.specialty}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <MapPin className="h-4 w-4" />
              {data.city}, {data.state}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {data.specialty} Advisors in {data.city}
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl">
            {data.advisorCount > 0
              ? `Connect with ${data.advisorCount} verified ${data.specialty.toLowerCase()} professional${data.advisorCount !== 1 ? 's' : ''} in ${data.city}, ${data.state}. Expert guidance for business owners and high-net-worth individuals.`
              : `We're building our network of ${data.specialty.toLowerCase()} advisors in ${data.city}. Check back soon or browse nearby areas.`
            }
          </p>

          {data.advisorCount > 0 && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
                <Users className="h-5 w-5 text-amber-400" />
                <span className="font-semibold">{data.advisorCount}</span>
                <span className="text-slate-300">Verified Advisor{data.advisorCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {data.advisors.length > 0 ? (
          <>
            <h2 className="text-xl font-bold text-navy-900 mb-6">
              Best {data.specialty} Advisors in {data.city}, {data.state}
            </h2>
            <div className="space-y-6">
              {data.advisors.map((advisor, index) => (
                <div
                  key={advisor.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Featured badge for first advisor */}
                  {index === 0 && data.advisors.length > 1 && (
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-4 py-1">
                      Featured {data.specialty} Advisor
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center text-navy-600 text-xl font-bold flex-shrink-0">
                        {advisor.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-xl font-bold text-navy-900">{advisor.name}</h3>
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
                            <p className="text-slate-600 mb-1">
                              {advisor.designation}
                              {advisor.firmName && ` at ${advisor.firmName}`}
                            </p>
                            <div className="flex items-center gap-1 text-slate-500 text-sm">
                              <MapPin className="h-4 w-4" />
                              {advisor.city}, {advisor.state}
                            </div>
                          </div>
                          <a
                            href={`/advisor/${advisor.slug}`}
                            className="px-4 py-2 bg-navy-900 text-white font-medium rounded-lg hover:bg-navy-800 transition-colors flex-shrink-0"
                          >
                            View Profile
                          </a>
                        </div>

                        {advisor.bio && (
                          <p className="text-slate-600 mt-4 line-clamp-2">
                            {advisor.bio}
                          </p>
                        )}

                        {advisor.specialties && advisor.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {advisor.specialties.map((spec, i) => (
                              <span
                                key={i}
                                className={`px-2 py-1 text-xs rounded ${
                                  spec.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === data.specialtySlug
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
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Related Links */}
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <a
                href={`/directory/${data.specialtySlug}`}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-navy-900 mb-2">
                  All {data.specialty} Advisors
                </h3>
                <p className="text-slate-600 text-sm">
                  Browse {data.specialty.toLowerCase()} advisors across all locations.
                </p>
              </a>
              <a
                href={`/directory/location/${data.citySlug}`}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-navy-900 mb-2">
                  All Advisors in {data.city}
                </h3>
                <p className="text-slate-600 text-sm">
                  See all CPAs and Wealth Advisors in {data.city}, {data.state}.
                </p>
              </a>
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <Users className="h-16 w-16 text-slate-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-700 mb-3">
              No {data.specialty} Advisors in {data.city} Yet
            </h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              We're still building our network of {data.specialty.toLowerCase()} advisors in {data.city}.
              Try one of these alternatives:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`/directory/${data.specialtySlug}`}
                className="px-6 py-3 bg-navy-900 text-white font-medium rounded-lg hover:bg-navy-800 transition-colors"
              >
                Browse All {data.specialty} Advisors
              </a>
              <a
                href={`/directory/location/${data.citySlug}`}
                className="px-6 py-3 border border-navy-900 text-navy-900 font-medium rounded-lg hover:bg-navy-50 transition-colors"
              >
                All Advisors in {data.city}
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
