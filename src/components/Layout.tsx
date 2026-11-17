import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function CorporateLayout({ children }: { children: React.ReactNode }) {
  const { user, publicSettings } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const companyName = publicSettings.company_name || 'RICHMOND-INV';
  const legalName = publicSettings.company_legal_name || 'Richmond Investment Holdings Ltd.';
  const regNote =
    publicSettings.company_registration_note ||
    'Registration & jurisdictional details configurable via Administrator Settings.';
  const hqAddress = publicSettings.headquarters_address || '24 Bishopsgate, London EC2N 4BQ, United Kingdom';
  const contactEmail = publicSettings.contact_email || 'investor.relations@richmond-inv.com';
  const contactPhone = publicSettings.contact_phone || '+44 20 7946 0180';

  const navLinks = [
    { to: '/about', label: 'About' },
    { to: '/offerings', label: 'Share Offerings' },
    { to: '/investment-strategy', label: 'Strategy' },
    { to: '/investor-relations', label: 'Investor Relations' },
    { to: '/contact', label: 'Contact' },
  ];

  const primaryCta =
    user?.accountType === 'admin'
      ? { to: '/admin', label: 'Admin Console' }
      : user?.accountType === 'investor'
      ? { to: '/portal', label: 'Investor Portal' }
      : { to: '/login', label: 'Investor Sign In' };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F7F2] text-[#1C2026]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#FCFBF8]/95 backdrop-blur border-b border-[#E5E8EE] no-print">
        <div className="max-w-[1280px] mx-auto px-6 h-18 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-serif text-xl font-semibold tracking-tight text-[#0B172A] whitespace-nowrap shrink-0"
          >
            {companyName}
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#4A5260]">
            {navLinks.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors ${
                    active
                      ? 'text-[#0B172A] border-[#B5924C]'
                      : 'border-transparent hover:text-[#0B172A] hover:border-[#D6DAE2]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={primaryCta.to}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold tracking-wide bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors whitespace-nowrap shrink-0"
            >
              {primaryCta.label}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 border border-[#D6DAE2] text-[#0B172A] bg-white"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-[#E5E8EE] bg-[#FCFBF8] px-6 py-4 space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-sm font-medium text-[#1C2026] border-b border-[#E5E8EE]"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to={primaryCta.to}
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center px-4 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8]"
              >
                {primaryCta.label}
              </Link>
              {!user && (
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center px-4 py-3 text-xs font-semibold border border-[#0B172A] text-[#0B172A]"
                >
                  Open Investor Account
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0B172A] text-[#D6DAE2] border-t border-[#1E365C] no-print">
        <div className="max-w-[1280px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="font-serif text-xl font-semibold text-[#FCFBF8]">{companyName}</div>
            <p className="text-xs leading-relaxed text-[#A8B2C1]">{legalName}</p>
            <p className="text-xs leading-relaxed text-[#A8B2C1]">{hqAddress}</p>
            <p className="text-xs text-[#A8B2C1]">
              {contactEmail} · {contactPhone}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[#C9A968] mb-4">Institution</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-white transition-colors">About RICHMOND-INV</Link></li>
              <li><Link to="/company-overview" className="hover:text-white transition-colors">Company Overview</Link></li>
              <li><Link to="/investment-philosophy" className="hover:text-white transition-colors">Investment Philosophy</Link></li>
              <li><Link to="/investment-opportunities" className="hover:text-white transition-colors">Investment Opportunities</Link></li>
              <li><Link to="/corporate-governance" className="hover:text-white transition-colors">Corporate Governance</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[#C9A968] mb-4">Shareholders</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/offerings" className="hover:text-white transition-colors">Share Offerings</Link></li>
              <li><Link to="/portfolio-information" className="hover:text-white transition-colors">Portfolio Information</Link></li>
              <li><Link to="/announcements" className="hover:text-white transition-colors">News & Announcements</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">Frequently Asked Questions</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Investor Registration</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[#C9A968] mb-4">Legal & Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/risk-disclosures" className="hover:text-white transition-colors">Risk Disclosures</Link></li>
              <li><Link to="/investment-risk-disclosures" className="hover:text-white transition-colors">Investment Risk Disclosures</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-conditions" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li>
                <a
                  href="/api/public/project-overview.pdf"
                  download="RICHMOND-INV-Project-Overview.pdf"
                  className="hover:text-white transition-colors"
                >
                  Project Overview (PDF)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1E365C] bg-[#060E1C]">
          <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#8E99AA]">
            <p>{regNote}</p>
            <p className="whitespace-nowrap">© {new Date().getFullYear()} {legalName}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
