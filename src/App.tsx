import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  Users,
  Receipt,
  TrendingUp,
  Sparkles,
  Target,
  Brain,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AdminDashboard } from './components/admin';
import { TOKEN_AUTH_MUTATION } from './lib/graphql';

const MODULES = [
  { icon: Users, title: 'AI Workforce', sub: 'HR & Payroll', wrap: 'bg-emerald-50 text-emerald-500' },
  { icon: Receipt, title: 'AI Invoice', sub: 'Smart Billing', wrap: 'bg-cyan-50 text-cyan-500' },
  { icon: TrendingUp, title: 'AI CRM', sub: 'Sales Pipelines', wrap: 'bg-indigo-50 text-indigo-500' },
  { icon: Sparkles, title: 'AI Performance', sub: '360° Reviews', wrap: 'bg-amber-50 text-amber-500' },
  { icon: Target, title: 'Goals & OKRs', sub: 'Team Alignment', wrap: 'bg-teal-50 text-teal-500' },
  { icon: Brain, title: 'AI Brain', sub: 'RAG Automation', wrap: 'bg-rose-50 text-rose-500' },
];

type LoginState = {
  username: string;
  password: string;
};

export default function App() {
  const [login, setLogin] = useState<LoginState>({ username: '', password: '' });
  const [adminUsername, setAdminUsername] = useState('');
  const [error, setError] = useState('');
  const [hide, setHide] = useState(true);

  const [loginUser, { loading }] = useMutation<{
    tokenAuth: {
      token: string;
      user: {
        username: string;
        isSuperuser: boolean;
      };
    };
  }, LoginState, any, any>(TOKEN_AUTH_MUTATION);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('adminUsername');

    if (token && storedUsername) {
      setAdminUsername(storedUsername);
    }
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!login.username.trim() || !login.password) {
      setError('Enter your username and password.');
      return;
    }

    try {
      const { data } = await loginUser({
        variables: {
          username: login.username.trim(),
          password: login.password,
        },
      });

      const auth = data?.tokenAuth;

      if (!auth) {
        setError('Authentication returned an empty response.');
        return;
      }

      if (!auth.user.isSuperuser) {
        setError('This dashboard is restricted to super admins.');
        return;
      }

      localStorage.setItem('token', auth.token);
      localStorage.setItem('adminUsername', auth.user.username);
      setAdminUsername(auth.user.username);
      setLogin({ username: '', password: '' });
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminUsername');
    setAdminUsername('');
  };

  if (adminUsername) {
    return <AdminDashboard username={adminUsername} onLogout={handleLogout} />;
  }

  return (
    <div className="h-screen bg-[#f8fafc] font-sans antialiased flex flex-col justify-between overflow-hidden text-slate-800">
      <div className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row relative">
        {/* LEFT: Branding panel */}
        <div className="hidden lg:flex lg:w-[55%] relative lg:h-full flex-col justify-between p-6 lg:p-10 bg-gradient-to-tr from-[#e8fcf9] via-[#f8fafc] to-[#f3fefa] overflow-y-auto border-r border-slate-100/80">
          {/* Glowing accent circles */}
          <div className="absolute top-[20%] right-[10%] w-72 h-72 rounded-full bg-[#00cbd6]/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-[20%] left-[10%] w-96 h-96 rounded-full bg-[#10b981]/5 blur-3xl pointer-events-none" />

          {/* Background curves */}
          <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
            <svg className="absolute w-[180%] h-[180%] -top-20 -left-[40%] text-[#00cbd6]/15" viewBox="0 0 1000 1000" fill="none">
              <path d="M950,50 C700,150 600,450 500,500 C400,550 300,850 50,950" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <svg className="absolute w-[150%] h-[150%] -bottom-10 -right-[20%] text-[#10b981]/10" viewBox="0 0 1000 1000" fill="none">
              <path d="M50,50 C300,100 450,400 500,500 C550,600 800,900 950,950" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
            </svg>
          </div>

          {/* Upper: logo + headline + bento grid */}
          <div className="relative z-10 flex flex-col gap-6 lg:gap-8 max-w-lg">
            <img src="/assets/penquee_logo.png" className="h-16 md:h-[72px] w-auto object-contain" alt="Penquee" />
            <div className="space-y-3">
              <h2 className="text-3xl lg:text-4xl xl:text-[42px] font-black leading-[1.1] tracking-tight text-slate-900">
                Seamless registration for modern enterprises.
              </h2>
              <p className="text-slate-600 text-sm font-medium mt-2 leading-relaxed">
                Trusted by organizations globally to streamline compliance and corporate governance.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 lg:gap-8 w-full">
              {MODULES.map((m) => (
                <div
                  key={m.title}
                  className="group bg-white/40 hover:bg-white/70 backdrop-blur-md border border-white/60 hover:border-[#00cbd6]/30 p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className={`p-2 rounded-xl ${m.wrap} group-hover:scale-110 transition-transform shadow-sm`}>
                    <m.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-800">{m.title}</h4>
                    <p className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">{m.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lower: mascot card */}
          <div className="relative z-10 mt-auto pt-6">
            <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-4 flex items-center gap-4 hover:shadow-xl transition-all duration-500 hover:scale-[1.01] max-w-sm">
              <div className="relative shrink-0 bg-white/80 rounded-2xl p-1.5 border border-slate-100 shadow-sm flex items-center justify-center">
                <img src="/assets/penquee_mascot.png" className="w-20 md:w-24 h-auto object-contain" alt="PenQ Mascot" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00cbd6]/10 text-[#00cbd6] text-[9px] font-extrabold tracking-wide uppercase">
                  AI Guide
                </div>
                <p className="text-slate-700 text-xs font-semibold leading-relaxed">
                  "Hi! I'm PenQ. Let's get your business registered!"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Form panel */}
        <div className="w-full lg:w-[45%] lg:h-full overflow-y-auto flex flex-col justify-center items-center p-6 sm:p-10 bg-white relative">
          <div className="w-full max-w-lg py-6 relative lg:mt-20">
            <div className="space-y-8">
              <div className="space-y-2 lg:hidden mb-6">
                <img src="/assets/penquee_logo.png" className="h-12 w-auto object-contain" alt="Penquee" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900">Welcome back</h3>
                <p className="text-slate-400 text-sm font-medium">
                  Enter your credentials to access your secure workspace.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={login.username}
                    autoComplete="username"
                    placeholder="Enter your username"
                    onChange={(event) => setLogin((current) => ({ ...current, username: event.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:bg-white focus:border-[#00cbd6] focus:ring-2 focus:ring-cyan-50 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                    <a href="#" className="text-xs font-bold text-[#00cbd6] hover:underline">Forgot?</a>
                  </div>
                  <div className="relative">
                    <input
                      type={hide ? 'password' : 'text'}
                      value={login.password}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-11 py-3.5 focus:bg-white focus:border-[#00cbd6] focus:ring-2 focus:ring-cyan-50 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setHide((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer flex items-center"
                    >
                      {hide ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00cbd6] hover:bg-[#00b9c3] text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 text-sm tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-slate-500 text-xs font-semibold pt-4">
                Super admin access only. Restricted environment.
              </p>
            </div>
          </div>

          <div className="w-full max-w-lg mt-auto pt-8">
            <div className="flex justify-center md:justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-wrap gap-4">
              <p>© 2026. All rights reserved. Secure cloud environment.</p>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-slate-600 transition-colors">Support Portal</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
