'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: 'email' | 'password') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store token in localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to admin dashboard
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-5 flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* Header */}
        <header className="text-center mb-8 p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-4xl font-bold mb-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-slate-400">
            Login to your clinic dashboard
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Email
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

          {/* Password */}
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange('password')}
                placeholder="Enter your password"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Login</span>
              </>
            )}
          </button>

          {/* Signup Link */}
          <p className="text-center text-slate-400 mt-4">
            Don't have an account?{' '}
            <a href="/signup" className="text-indigo-400 hover:underline font-medium">
              Create one here
            </a>
          </p>
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
