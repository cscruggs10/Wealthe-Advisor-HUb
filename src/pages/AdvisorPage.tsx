import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Shield, MapPin, Award, Globe, Linkedin, ArrowLeft, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface Advisor {
  id: string;
  name: string;
  firmName: string | null;
  designation: string;
  city: string;
  state: string;
  zipCode: string;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  specialties: string[] | null;
  isVerifiedStrategist: boolean;
  slug: string;
}

export default function AdvisorPage() {
  const [, params] = useRoute('/advisor/:slug');
  const slug = params?.slug;

  const { data: advisor, isLoading, error } = useQuery<Advisor>({
    queryKey: ['advisor', slug],
    queryFn: async () => {
      const res = await fetch(`/api/advisors/slug/${slug}`);
      if (!res.ok) throw new Error('Advisor not found');
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-navy-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !advisor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Advisor Not Found</h1>
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
            <Shield className="h-8 w-8 text-emerald-400" />
            <span className="text-xl font-bold">Wealth Advisor Hub</span>
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <a href="/search" className="inline-flex items-center gap-1 text-slate-600 hover:text-navy-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </a>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center text-navy-600 text-2xl font-bold">
                  {advisor.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-navy-900">{advisor.name}</h1>
                    {advisor.isVerifiedStrategist && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                        <Award className="h-3 w-3" />
                        Strategic Partner
                      </span>
                    )}
                  </div>
                  <p className="text-lg text-slate-600 mb-2">{advisor.designation}</p>
                  {advisor.firmName && (
                    <p className="text-slate-500">{advisor.firmName}</p>
                  )}
                  <div className="flex items-center gap-1 text-slate-500 mt-2">
                    <MapPin className="h-4 w-4" />
                    {advisor.city}, {advisor.state} {advisor.zipCode}
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-slate-200">
                {advisor.websiteUrl && (
                  <a
                    href={advisor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy-600 hover:text-navy-800"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
                {advisor.linkedinUrl && (
                  <a
                    href={advisor.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy-600 hover:text-navy-800"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Bio */}
            {advisor.bio && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-3">About</h2>
                <p className="text-slate-600 leading-relaxed">{advisor.bio}</p>
              </div>
            )}

            {/* Specialties */}
            {advisor.specialties && advisor.specialties.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-navy-900 mb-3">Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {advisor.specialties.map((specialty, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Lead Form */}
          <div className="space-y-6">
            <LeadForm advisor={advisor} />
          </div>
        </div>
      </main>
    </div>
  );
}

function LeadForm({ advisor }: { advisor: Advisor }) {
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          advisorId: advisor.id,
          sourcePage: advisor.slug,
          sourceType: 'reinsurance_cta',
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-emerald-800 mb-2">Thank You!</h3>
        <p className="text-emerald-700 text-sm">
          Your inquiry has been sent. We'll be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Proactive Tax Strategy CTA */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 text-white rounded-lg p-6">
        <h3 className="text-lg font-bold mb-2">Proactive Tax Strategy</h3>
        <p className="text-slate-300 text-sm mb-4">
          Is your advisor using <span className="text-emerald-400 font-semibold">Reinsurance Domiciles</span> to save you $100k+ in taxes?
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Your Name"
            required
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            className="w-full px-3 py-2 text-slate-900 rounded-md text-sm"
          />
          <input
            type="email"
            placeholder="Your Email"
            required
            value={formData.userEmail}
            onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
            className="w-full px-3 py-2 text-slate-900 rounded-md text-sm"
          />
          <textarea
            placeholder="Tell us about your situation..."
            rows={3}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full px-3 py-2 text-slate-900 rounded-md text-sm resize-none"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Sending...' : 'Get a Free Consultation'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-3 text-center">
          No spam. We respect your privacy.
        </p>
      </div>

      {/* Trust Badges */}
      {advisor.isVerifiedStrategist && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Award className="h-5 w-5" />
            <span className="font-medium text-sm">Verified Strategic Partner</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            This advisor has demonstrated expertise in advanced tax strategies.
          </p>
        </div>
      )}
    </>
  );
}
