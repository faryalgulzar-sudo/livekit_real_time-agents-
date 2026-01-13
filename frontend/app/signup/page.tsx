'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Timezone options
const TIMEZONES = [
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)' },
  { value: 'Asia/Dubai', label: 'UAE (GST)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (AST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'America/New_York', label: 'US Eastern (EST)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PST)' },
];

// Country options
const COUNTRIES = [
  'Pakistan', 'UAE', 'Saudi Arabia', 'India', 'UK', 'USA', 'Canada', 'Australia', 'Other'
];

// Specialty options
const SPECIALTIES = [
  { value: '', label: 'Select Specialty (Optional)' },
  { value: 'general_dentist', label: 'General Dentist' },
  { value: 'orthodontist', label: 'Orthodontist' },
  { value: 'periodontist', label: 'Periodontist' },
  { value: 'endodontist', label: 'Endodontist' },
  { value: 'oral_surgeon', label: 'Oral Surgeon' },
  { value: 'pediatric_dentist', label: 'Pediatric Dentist' },
  { value: 'prosthodontist', label: 'Prosthodontist' },
  { value: 'cosmetic_dentist', label: 'Cosmetic Dentist' },
  { value: 'other', label: 'Other' },
];

interface SignupForm {
  clinic_name: string;
  doctor_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  country: string;
  timezone: string;
  website: string;
  clinic_address: string;
  specialty: string;
  allowed_domains: string;
  agree_terms: boolean;
}

interface SignupResult {
  success: boolean;
  tenant_id: string;
  public_key: string;
  plan: string;
  free_limit_pages: number;
}

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>({
    clinic_name: '',
    doctor_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    country: 'Pakistan',
    timezone: 'Asia/Karachi',
    website: '',
    clinic_address: '',
    specialty: '',
    allowed_domains: '',
    agree_terms: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: keyof SignupForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!form.clinic_name.trim()) return 'Clinic name is required';
    if (!form.doctor_name.trim()) return 'Doctor name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!form.phone.trim()) return 'Phone number is required';
    if (!form.password) return 'Password is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirm_password) return 'Passwords do not match';
    if (!form.agree_terms) return 'You must accept the Terms & Conditions';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_name: form.clinic_name,
          doctor_name: form.doctor_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          country: form.country,
          timezone: form.timezone,
          website: form.website || null,
          clinic_address: form.clinic_address || null,
          specialty: form.specialty || null,
          allowed_domains: form.allowed_domains || null,
          agree_terms: form.agree_terms,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Signup failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (result) {
    return (
      <div className="min-h-screen p-5 flex items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-green-500/30 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Account Created!</h1>
            <p className="text-slate-400 mb-6">Your clinic account is ready to use.</p>

            <div className="bg-slate-900 rounded-xl p-5 text-left mb-6 border border-slate-700">
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 text-sm">Tenant ID</span>
                  <p className="text-slate-100 font-mono text-sm break-all">{result.tenant_id}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Public Key (for widget)</span>
                  <p className="text-indigo-400 font-mono text-sm break-all">{result.public_key}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Plan</span>
                  <p className="text-yellow-400 font-semibold">{result.plan} - {result.free_limit_pages} page placements</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href="/login"
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-indigo-500/40 text-center"
              >
                Login Now
              </a>
              <a
                href="/"
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-lg transition-all duration-300 text-center"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-4xl font-bold mb-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="text-slate-400 text-lg">
            Get started with your free AI voice agent
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <span className="text-yellow-400">⭐</span>
            <span className="text-yellow-400 text-sm font-medium">FREE Plan: Embed on up to 5 pages</span>
          </div>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          {/* Section: Clinic Info */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span>🏥</span>
              <span>Clinic Information</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Clinic Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.clinic_name}
                  onChange={handleChange('clinic_name')}
                  placeholder="e.g., Smile Dental Clinic"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Doctor Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.doctor_name}
                  onChange={handleChange('doctor_name')}
                  placeholder="e.g., Dr. Ahmed Khan"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Specialty
                </label>
                <select
                  value={form.specialty}
                  onChange={handleChange('specialty')}
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={handleChange('website')}
                  placeholder="https://www.yourclinic.com"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Clinic Address
                </label>
                <textarea
                  value={form.clinic_address}
                  onChange={handleChange('clinic_address')}
                  placeholder="Full clinic address..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Contact Info */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span>📧</span>
              <span>Contact Information</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="doctor@clinic.com"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Phone <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  placeholder="+92 300 1234567"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Country <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.country}
                  onChange={handleChange('country')}
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  required
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Timezone <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.timezone}
                  onChange={handleChange('timezone')}
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  required
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Security */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span>🔒</span>
              <span>Security</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange('password')}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirm_password}
                  onChange={handleChange('confirm_password')}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section: Widget Settings */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span>🔧</span>
              <span>Widget Settings (Optional)</span>
            </h2>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Allowed Domains
              </label>
              <input
                type="text"
                value={form.allowed_domains}
                onChange={handleChange('allowed_domains')}
                placeholder="clinic.com, booking.clinic.com (comma-separated)"
                className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-slate-500 text-xs mt-2">
                Leave empty to allow all domains. Specify domains where widget can be embedded.
              </p>
            </div>
          </div>

          {/* Section: Terms & Submit */}
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
                <span>❌</span>
                <span>{error}</span>
              </div>
            )}

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.agree_terms}
                onChange={handleChange('agree_terms')}
                className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-slate-300 text-sm group-hover:text-slate-100">
                I agree to the <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>
                <span className="text-red-400"> *</span>
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Create Free Account</span>
                </>
              )}
            </button>

            {/* Login Link */}
            <p className="text-center text-slate-400 mt-4">
              Already have an account?{' '}
              <a href="/login" className="text-indigo-400 hover:underline font-medium">
                Login here
              </a>
            </p>
          </div>
        </form>

        {/* Footer */}
        <footer className="text-center p-5 mt-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span>←</span>
            <span>Back to Home</span>
          </a>
          <p className="text-slate-500 mt-4 text-sm">
            Powered by LiveKit • Real-time Voice AI
          </p>
        </footer>
      </div>
    </div>
  );
}
