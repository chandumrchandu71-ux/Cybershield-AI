import type { AppPage } from './Navbar.tsx';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <p className="font-display text-sm font-semibold text-slate-900">
            CyberShield AI
          </p>
          <p className="max-w-xl text-xs leading-relaxed text-slate-500">
            URL-based phishing and fraudulent website detection using Random Forest feature
            classification. Automated lexical checks assist verification and do not guarantee a
            website is safe.
          </p>
        </div>

        <nav
          aria-label="Footer Navigation"
          className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            URL Scanner
          </button>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('result')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Latest Result
          </button>
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            About & Model
          </button>
        </nav>
      </div>
    </footer>
  );
}
