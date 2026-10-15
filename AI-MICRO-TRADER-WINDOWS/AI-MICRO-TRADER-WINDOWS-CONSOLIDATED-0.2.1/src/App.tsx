import React, { useState, useEffect } from 'react';
import { ClientLicenseState, licensingService } from './services/licensingService';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ActivationScreen } from './components/ActivationScreen';
import { MemberPortal } from './components/MemberPortal';

export default function App() {
  const [licenseState, setLicenseState] = useState<ClientLicenseState>(licensingService.getState());
  const [showMemberPortal, setShowMemberPortal] = useState(false);
  // Set VITE_APP_DISTRIBUTION=desktop or android for live-only builds.
  const liveOnlyBuild = import.meta.env.VITE_APP_DISTRIBUTION === 'desktop' || import.meta.env.VITE_APP_DISTRIBUTION === 'android';
  const [dashboardEnvironment, setDashboardEnvironment] = useState<'demo' | 'production'>('demo');
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'activation'>('landing');

  useEffect(() => {
    const unsubscribe = licensingService.subscribe((state) => {
      setLicenseState(state);
    });
    return unsubscribe;
  }, []);

  // Live-only packages proceed to the production dashboard after key activation.
  useEffect(() => {
    if (liveOnlyBuild && licenseState.status === 'ACTIVE') {
      setDashboardEnvironment('production');
      setCurrentView('dashboard');
    }
    if (liveOnlyBuild && licenseState.status !== 'ACTIVE') {
      setCurrentView('activation');
    }
  }, [liveOnlyBuild, licenseState.status]);


  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans">
      {/* View routing: Landing Page, Dashboard, or Activation Screen */}
      {currentView === 'landing' && !liveOnlyBuild ? (
        <LandingPage
          licenseState={licenseState}
          onOpenAdmin={() => { /* Customer app: no admin navigation */ }}
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
          onOpenAdmin={() => { /* Customer app: no admin navigation */ }}
          onBackToLanding={() => setCurrentView('landing')}
          onOpenMemberPortal={() => setShowMemberPortal(true)}
        />
      ) : (
        <ActivationScreen
          licenseState={licenseState}
          onOpenAdmin={() => { /* Customer app: no admin navigation */ }}
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

    </div>
  );
}
