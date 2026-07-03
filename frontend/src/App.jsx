// =====================================================================
// [App.jsx: Streamlit 100% 동기화 + 부분 수선 Inpainting 통합 지휘관]
// =====================================================================
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ErrorBanner from './components/ErrorBanner';
import ImageUploader from './components/ImageUploader';
// StyleSelector는 ChatWidget 통합으로 인해 제거되었습니다.
import ImageEditor from './components/ImageEditor';
import ComparisonGallery from './components/ComparisonGallery';
import SessionModal from './components/SessionModal';
import ChatWidget from './components/ChatWidget';
import { checkHealth } from './services/api';

// 글로벌 가로 탑 네비게이션 바 컴포넌트 (시안 GNB 그대로 구현)
function TopNav({ serverStatus, onRefreshHealth, sessionId, onOpenSessionModal }) {
  const [activeTab, setActiveTab] = React.useState('home');

  const handleScrollTo = (id, tabName) => {
    setActiveTab(tabName);
    if (tabName === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(id);
      if (el) {
        const offset = 100;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <header className="top-nav">
      <div className="top-nav-logo">LUXCHAUS</div>
      <nav className="top-nav-menu">
        <span 
          className={`top-nav-link ${activeTab === 'home' ? 'active' : ''}`} 
          onClick={() => handleScrollTo('home', 'home')}
        >
          Home
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'transform' ? 'active' : ''}`} 
          onClick={() => handleScrollTo('uploader-card', 'transform')}
        >
          AI Transform
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'editor' ? 'active' : ''}`} 
          onClick={() => handleScrollTo('editor-card', 'editor')}
        >
          Repair Studio
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'gallery' ? 'active' : ''}`} 
          onClick={() => handleScrollTo('gallery-card', 'gallery')}
        >
          Showroom
        </span>
      </nav>
      <div className="top-nav-actions">
        {serverStatus.online ? (
          <span className="badge badge-online" style={{ cursor: 'pointer' }} onClick={onRefreshHealth} title="서버 연결됨 (클릭하여 새로고침)">🟢 Online</span>
        ) : (
          <span className="badge badge-offline" style={{ cursor: 'pointer' }} onClick={onRefreshHealth} title="서버 연결 끊김 (클릭하여 새로고침)">🔴 Offline</span>
        )}
        {sessionId && (
          <button onClick={onOpenSessionModal} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px' }}>
            📋 History
          </button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const [serverStatus, setServerStatus] = useState({ loading: true, online: false, error: null });
  
  const [imageId, setImageId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [resultData, setResultData] = useState(null);

  const [currentError, setCurrentError] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const verifyServerHealth = useCallback(async () => {
    setServerStatus(prev => ({ ...prev, loading: true }));
    const res = await checkHealth();
    
    if (res.online) {
      setServerStatus({ loading: false, online: true, error: null });
      setCurrentError(prev => prev?.errorCode === "SERVER_CONNECTION_FAILED" ? null : prev);
    } else {
      setServerStatus({ loading: false, online: false, error: res.error });
      setCurrentError({
        errorCode: "SERVER_CONNECTION_FAILED",
        message: res.error
      });
    }
  }, []);

  useEffect(() => {
    verifyServerHealth();
  }, [verifyServerHealth]);

  const handleUploadSuccess = (data) => {
    setImageId(data.imageId);
    setSessionId(data.sessionId);
    setOriginalImageUrl(data.originalImageUrl);
    setResultData(null);
    setCurrentError(null);
  };

  const handleGenerateSuccess = (data) => {
    setResultData(data);
    setCurrentError(null);
  };

  return (
    <div className="app-layout">
      {/* 최상단 글로벌 GNB 메뉴바 */}
      <TopNav
        serverStatus={serverStatus}
        onRefreshHealth={verifyServerHealth}
        sessionId={sessionId}
        onOpenSessionModal={() => setShowSessionModal(true)}
      />

      {/* 가로 100% 꽉 차는 메인 포트폴리오 작업 영역 */}
      <main className="main-content">
        
        {/* 전체 화면 시네마틱 히어로 섹션 (쪼개진 두 창 없이 이미지 100% 풀스크린 오버레이) */}
        <section className="hero-fullscreen">
          <div className="hero-overlay">
            <div style={{ fontSize: '0.9rem', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '12px' }}>
              🏠 ZipPT Interior Transform MVP
            </div>
            <h1 className="hero-title">Refined Living Starts Here</h1>
            <p className="hero-subtitle">
              Discover timeless furniture and curated essentials designed for elevated spaces.<br />
              거실, 방, 침실 사진을 업로드하여 <strong>전면 리모델링(스타일 변환)</strong>을 하거나, 
              마우스 드래그로 <strong>특정 가구만 선택 교체(부분 수선)</strong>할 수 있는 AI 인테리어 스튜디오입니다.
            </p>
            {/* 시안 이미지 속 2대 프리미엄 버튼의 실 작동 연동 */}
            <div className="hero-buttons">
              <button 
                onClick={() => document.getElementById('uploader-card')?.scrollIntoView({ behavior: 'smooth' })} 
                className="btn btn-primary"
              >
                Shop Now
              </button>
              <button 
                onClick={() => setShowSessionModal(true)} 
                className="btn btn-secondary"
              >
                Explore Collection
              </button>
            </div>
          </div>
        </section>

        {/* 에러 안내판 */}
        <ErrorBanner
          error={currentError}
          onClose={() => setCurrentError(null)}
          onRetry={currentError?.errorCode === "SERVER_CONNECTION_FAILED" ? verifyServerHealth : null}
        />

        {/* 1단계: 인테리어 사진 업로더 */}
        <div id="uploader-card">
          <ImageUploader
            imageId={imageId}
            sessionId={sessionId}
            originalImageUrl={originalImageUrl}
            onUploadSuccess={handleUploadSuccess}
            onError={setCurrentError}
          />
        </div>

        {/* 2단계: 챗봇 연동 안내 가이드 (StyleSelector 통합 대체) */}
        {imageId && (
          <div id="transform-card" className="card" style={{ border: '1px solid #C7B7AE', background: '#FCFAF7', color: '#2A2825', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="card-title" style={{ color: '#2B3530', fontSize: '1.25rem', fontWeight: '800' }}>
              🎨 3. 챗봇 연동형 AI 인테리어 리모델링
            </div>
            <div className="card-desc" style={{ color: '#7A6C62', lineHeight: '1.5' }}>
              사진 업로드가 성공적으로 완료되었습니다! <br />
              이제 **우측 하단의 [💬 AI 인테리어 취향 상담] 버튼**을 눌러 메신저 창을 열고, 원하는 리모델링 요구사항을 채팅으로 입력해 주세요. <br />
              입력하는 즉시 AI가 이미지를 분석하고 인테리어를 변환하여 쇼룸에 갱신해 드립니다.
            </div>
            <div style={{ background: '#F3EBE5', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #2B3530', fontSize: '0.85rem', color: '#2A2825', marginTop: '6px' }}>
              <strong>추천 명령 예시:</strong> <br />
              • "화사한 북유럽 스타일로 변환해줘" <br />
              • "따뜻한 우드 감성의 내추럴 룸으로 꾸며줄래?" <br />
              • "도시적이고 시크한 그레이톤 미니멀 공간으로 바꿔줘"
            </div>
          </div>
        )}

        {/* 3단계: 부분 가구 교체 및 수선 - Image Inpainting (사진 등록 후 노출) */}
        <div id="editor-card">
          <ImageEditor
            imageId={imageId}
            sessionId={sessionId}
            originalImageUrl={originalImageUrl}
            onError={setCurrentError}
          />
        </div>

        {/* 4단계: Before / After 비교 쇼룸 */}
        <div id="gallery-card">
          <ComparisonGallery
            originalImageUrl={originalImageUrl}
            resultData={resultData}
            onError={setCurrentError}
          />
        </div>

        {/* 하단 카피라이트 */}
        <footer style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', fontWeight: '500' }}>
          ZipPT Interior Transform React MVP &copy; 2026
        </footer>
      </main>

      {/* 세션 장부 모달 */}
      {showSessionModal && (
        <SessionModal
          sessionId={sessionId}
          onClose={() => setShowSessionModal(false)}
        />
      )}

      {/* 5단계: AI 인테리어 취향 & 추구미 1:1 상담 메신저 위젯 (이미지 변환 연동) */}
      <ChatWidget 
        sessionId={sessionId} 
        imageId={imageId}
        onGenerateSuccess={handleGenerateSuccess}
        onError={setCurrentError}
      />
    </div>
  );
}
