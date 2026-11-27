import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { ComponentKitPage } from './features/kit/ComponentKitPage';
import { QuickCheckPage } from './features/quickcheck/QuickCheckPage';
import { AccountPage } from './features/account/AccountPage';
import { SignInPage } from './features/account/SignInPage';
import { HomePage } from './features/home/HomePage';
import { AdminPage } from './features/admin/AdminPage';
import { PrivacyPage } from './features/legal/PrivacyPage';
import { TermsPage } from './features/legal/TermsPage';
import { WhatsAppButton } from './features/support/WhatsAppButton';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/check" element={<QuickCheckPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/kit" element={<ComponentKitPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WhatsAppButton />
    </BrowserRouter>
  );
}

export default App;