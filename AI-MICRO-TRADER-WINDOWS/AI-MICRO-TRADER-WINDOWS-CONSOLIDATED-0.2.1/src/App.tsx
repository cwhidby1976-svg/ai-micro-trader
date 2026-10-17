import React, { useState, useEffect } from 'react';
import { ClientLicenseState, licensingService } from './services/licensingService';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { ActivationScreen } from './components/ActivationScreen';
import { MemberPortal } from './components/MemberPortal';
import { RiskDisclaimer, isPublicDisclaimerPath } from './components/RiskDisclaimer';

export default function App() {
  const [licenseState, setLicenseState] = useState<ClientLicenseState>(licensingService.getState());
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showMemberPortal, setShowMemberPortal] = useState(false);
  // Set VITE_APP_DISTRIBUTION=desktop or android for live-only builds.
  const liveOnlyBuild = import.meta.env.VITE_APP_DISTRIBUTION === 'desktop' || import.meta.env.VITE_APP_DISTRIBUTION === 'android';
  const [dashboardEnvironment, setDashboardEnvironment] = useState<'demo' | 'production'>('demo');
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'activation' | 'disclaimer'>(() =>
    typeof window !== 'undefined' && isPublicDisclaimerPath() ? 'disclaimer' : 'landing'
  );

  useEffect(() => {
    const unsubscribe = licensingService.subscribe((state) => {
      setLicenseState(state);
    });
    return unsubscribe;
  }, []);

  // Live-only packages proceed to the production dashboard after key activation.
  useEffect(() => {
    if (isPublicDisclaimerPath()) {
      setCurrentView('disclaimer');
      return;
    }
    if (liveOnlyBuild && licenseState.status === 'ACTIVE') {
      setDashboardEnvironment('production');
      setCurrentView('dashboard');
    }
    if (liveOnlyBuild && licenseState.status !== 'ACTIVE') {
      setCurrentView('activation');
    }
  }, [liveOnlyBuild, licenseState.status]);

  // Admin URL routing (?admin=true, #admin, or keyboard shortcut Alt+A / Ctrl+Shift+A)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAdminRoute = () => {
        if (isPublicDisclaimerPath()) {
          setCurrentView('disclaimer');
          return;
        }
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        if (path === '/') {
          setCurrentView((prev) => {
            if (prev !== 'disclaimer') return prev;
            if (liveOnlyBuild) {
              return licenseState.status === 'ACTIVE' ? 'dashboard' : 'activation';
            }
            return 'landing';
          });
        }
        const params = new URLSearchParams(window.location.search);
        if (
          params.get('admin') === 'true' ||
          window.location.hash === '#admin' ||
          window.location.pathname === '/admin'
        ) {
          setShowAdminPortal(true);
        }
        if (params.get('view') === 'dashboard') {
          if (!liveOnlyBuild) { setDashboardEnvironment('demo'); setCurrentView('dashboard'); }
          else { setCurrentView('activation'); }
        }
      };

      checkAdminRoute();
      window.addEventListener('hashchange', checkAdminRoute);
      window.addEventListener('popstate', checkAdminRoute);

      const handleKeyDown = (e: KeyboardEvent) => {
        // Discrete keyboard shortcut for site administrators: Alt+A or Ctrl+Shift+A
        if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) {
          setShowAdminPortal(true);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('hashchange', checkAdminRoute);
        window.removeEventListener('popstate', checkAdminRoute);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [liveOnlyBuild, licenseState.status]);

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans">
      {currentView === 'disclaimer' ? (
        <RiskDisclaimer />
      ) : currentView === 'landing' && !liveOnlyBuild ? (
        <LandingPage
          licenseState={licenseState}
          onOpenAdmin={() => setShowAdminPortal(true)}
          onOpenMemberPortal={() => setShowMemberPortal(true)}
          onEnterDashboard={() => {
            if (licenseState.status === 'ACTIVE') {
              setDashboardEnvironment('production');
              setCurrentView('dashboard');
            } else {
              setCurrentView('activation');
            }
          }}
          onEnterDemoMode={() => {
            if (!liveOnlyBuild) { setDashboardEnvironment('demo'); setCurrentView('dashboard'); } else { setCurrentView('activation'); }
          }}
        />
      ) : currentView === 'dashboard' && (!liveOnlyBuild || (licenseState.status === 'ACTIVE' && dashboardEnvironment === 'production')) ? (
        <Dashboard
          environment={dashboardEnvironment}
          licenseState={licenseState}
          onOpenAdmin={() => setShowAdminPortal(true)}
          onBackToLanding={() => setCurrentView('landing')}
          onOpenMemberPortal={() => setShowMemberPortal(true)}
        />
      ) : (
        <ActivationScreen
          licenseState={licenseState}
          onOpenAdmin={() => setShowAdminPortal(true)}
          onBackToLanding={() => setCurrentView('landing')}
          onOpenMemberPortal={() => setShowMemberPortal(true)}
          onEnterDemoMode={() => { if (!liveOnlyBuild) { setDashboardEnvironment('demo'); setCurrentView('dashboard'); } }}
        />
      )}

      {/* Member Portal Modal */}
      {showMemberPortal && (
        <MemberPortal
          onClose={() => setShowMemberPortal(false)}
          onActivateKeyInApp={async (code) => {
            setShowMemberPortal(false);
            await licensingService.activate(code);
          }}
        />
      )}

      {/* Admin Portal Modal */}
      {showAdminPortal && (
        <AdminPortal onClose={() => setShowAdminPortal(false)} />
      )}
    </div>
  );
}
