import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { HomePage } from './pages/public/HomePage';
import { AnnouncementsPage, CmsCorporatePage, ContactPage, FaqPage } from './pages/public/CorporatePages';
import { OfferingDetailPublicPage, OfferingsPublicPage } from './pages/public/OfferingsPublicPage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/public/AuthPages';

import { InvestorDashboardPage } from './pages/investor/InvestorDashboardPage';
import { InvestorOfferingsPage } from './pages/investor/InvestorOfferingsPage';
import { InvestorOrdersPage } from './pages/investor/InvestorOrdersPage';
import { InvestorPaymentPage } from './pages/investor/InvestorPaymentPage';
import { InvestorKycPage } from './pages/investor/InvestorKycPage';
import { InvestorPortfolioPage } from './pages/investor/InvestorPortfolioPage';
import { InvestorWithdrawPage } from './pages/investor/InvestorWithdrawPage';
import { InvestorAccountPage } from './pages/investor/InvestorAccountPage';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminInvestorsPage } from './pages/admin/AdminInvestorsPage';
import { AdminKycPage } from './pages/admin/AdminKycPage';
import { AdminOfferingsPage } from './pages/admin/AdminOfferingsPage';
import { AdminOrdersPaymentsPage } from './pages/admin/AdminOrdersPaymentsPage';
import { AdminWithdrawalsPage } from './pages/admin/AdminWithdrawalsPage';
import { AdminPortfolioDividendsPage } from './pages/admin/AdminPortfolioDividendsPage';
import { AdminCmsPage, AdminReportsPage, AdminSettingsPage } from './pages/admin/AdminCmsSettingsReportsPage';

function RequireInvestorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#F9F7F2]" />;
  if (!user || user.accountType !== 'investor') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#060E1C]" />;
  if (!user || user.accountType !== 'admin') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter useTransitions={false}>
          <Routes>
            {/* 19 Public Corporate Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<CmsCorporatePage slug="about" fallbackTitle="About RICHMOND-INV" />} />
            <Route
              path="/company-overview"
              element={<CmsCorporatePage slug="company-overview" fallbackTitle="Company Overview" />}
            />
            <Route
              path="/investment-philosophy"
              element={<CmsCorporatePage slug="investment-philosophy" fallbackTitle="Investment Philosophy" />}
            />
            <Route path="/investment-opportunities" element={<OfferingsPublicPage />} />
            <Route path="/offerings" element={<OfferingsPublicPage />} />
            <Route path="/offerings/:slug" element={<OfferingDetailPublicPage />} />
            <Route
              path="/investment-strategy"
              element={<CmsCorporatePage slug="investment-strategy" fallbackTitle="Investment Strategy" />}
            />
            <Route
              path="/portfolio-information"
              element={<CmsCorporatePage slug="portfolio-information" fallbackTitle="Portfolio Information" />}
            />
            <Route
              path="/investor-relations"
              element={<CmsCorporatePage slug="investor-relations" fallbackTitle="Investor Relations" />}
            />
            <Route
              path="/corporate-governance"
              element={<CmsCorporatePage slug="corporate-governance" fallbackTitle="Corporate Governance" />}
            />
            <Route
              path="/risk-disclosures"
              element={<CmsCorporatePage slug="risk-disclosures" fallbackTitle="Risk Disclosures" />}
            />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/privacy-policy"
              element={<CmsCorporatePage slug="privacy-policy" fallbackTitle="Privacy Policy" />}
            />
            <Route
              path="/terms-conditions"
              element={<CmsCorporatePage slug="terms-conditions" fallbackTitle="Terms and Conditions" />}
            />
            <Route
              path="/investment-risk-disclosures"
              element={
                <CmsCorporatePage slug="investment-risk-disclosures" fallbackTitle="Investment Risk Disclosures" />
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Investor Portal */}
            <Route
              path="/portal"
              element={
                <RequireInvestorRoute>
                  <InvestorDashboardPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/offerings"
              element={
                <RequireInvestorRoute>
                  <InvestorOfferingsPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/orders"
              element={
                <RequireInvestorRoute>
                  <InvestorOrdersPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/pay/:requestId"
              element={
                <RequireInvestorRoute>
                  <InvestorPaymentPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/kyc"
              element={
                <RequireInvestorRoute>
                  <InvestorKycPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/portfolio"
              element={
                <RequireInvestorRoute>
                  <InvestorPortfolioPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/withdraw"
              element={
                <RequireInvestorRoute>
                  <InvestorWithdrawPage />
                </RequireInvestorRoute>
              }
            />
            <Route
              path="/portal/account"
              element={
                <RequireInvestorRoute>
                  <InvestorAccountPage />
                </RequireInvestorRoute>
              }
            />

            {/* Separate Administrator Portal */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdminRoute>
                  <AdminDashboardPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/investors"
              element={
                <RequireAdminRoute>
                  <AdminInvestorsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/kyc"
              element={
                <RequireAdminRoute>
                  <AdminKycPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/offerings"
              element={
                <RequireAdminRoute>
                  <AdminOfferingsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <RequireAdminRoute>
                  <AdminOrdersPaymentsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <RequireAdminRoute>
                  <AdminWithdrawalsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/portfolios"
              element={
                <RequireAdminRoute>
                  <AdminPortfolioDividendsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/cms"
              element={
                <RequireAdminRoute>
                  <AdminCmsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireAdminRoute>
                  <AdminSettingsPage />
                </RequireAdminRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <RequireAdminRoute>
                  <AdminReportsPage />
                </RequireAdminRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
