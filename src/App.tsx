import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './app/provider';

// 페이지들 불러오기
import { LandingPage } from './pages/LandingPage';
import { BankPortalPage } from './features/bank-portal/BankPortalPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';

function App() {
  return (
    // 1. 디자인/지갑 설정(Provider)으로 전체를 감싸고
    <AppProvider>
      {/* 2. 라우터(BrowserRouter)로 페이지 이동 기능을 켭니다 */}
      <BrowserRouter>
        <Routes>
          {/* 3. 주소별로 보여줄 페이지를 정합니다 */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<BankPortalPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;