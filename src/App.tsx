import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { AdminDashboard } from './components/admin';
import { TOKEN_AUTH_MUTATION } from './lib/graphql';

type LoginState = {
  username: string;
  password: string;
};

export default function App() {
  const [login, setLogin] = useState<LoginState>({ username: '', password: '' });
  const [adminUsername, setAdminUsername] = useState('');
  const [error, setError] = useState('');

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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500 text-slate-950">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Supreme Dashboard</h1>
              <p className="text-sm text-slate-400">Super admin access</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Username</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                value={login.username}
                autoComplete="username"
                onChange={(event) => setLogin((current) => ({ ...current, username: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  value={login.password}
                  type="password"
                  autoComplete="current-password"
                  onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={loading}
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
