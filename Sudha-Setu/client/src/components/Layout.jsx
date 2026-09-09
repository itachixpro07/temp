import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, HeartPulse, Home, Leaf, Pill, User } from 'lucide-react';
import { useAuth } from '../lib/useAuth';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/diseases', label: 'Conditions', icon: HeartPulse },
  { to: '/medicines', label: 'Remedies', icon: Pill },
  { to: '/hospitals', label: 'Hospitals', icon: Building2 },
  { to: '/account', label: 'Account', icon: User },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6 px-5">
          <NavLink to="/" className="flex items-center gap-2">
            <Leaf size={20} className="text-tulsi" aria-hidden="true" />
            <span className="font-serif text-lg leading-none">
              Sudha Setu
              <span className="ml-2 hidden text-sm text-muted sm:inline">सुधा सेतु</span>
            </span>
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-sage font-medium text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto md:ml-0">
            {user ? (
              <button type="button" onClick={handleSignOut} className="btn-ghost">
                Sign out
              </button>
            ) : (
              <NavLink to="/signin" className="btn-primary">
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Patients mostly arrive on a phone in a waiting room, so navigation
          sits within thumb reach on small screens. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  isActive ? 'text-tulsi' : 'text-muted'
                }`
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <footer className="hidden border-t border-line px-5 py-6 md:block">
        <p className="mx-auto max-w-5xl text-xs text-muted">
          Sudha Setu helps you prepare before an OPD visit. It does not diagnose and does not
          replace a doctor. Problem statement SIH26047, Ministry of Ayush.
        </p>
      </footer>
    </div>
  );
}
