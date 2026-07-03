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
import StyleEncyclopedia, { STYLE_DATABASE } from './components/StyleEncyclopedia';
import { checkHealth } from './services/api';
import { Sofa, Bed, Table, Monitor, Trees, Archive, Lamp, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

// [가구 카테고리 퀵 링크 아이콘 정보 리스트 (시안 이미지 스타일 그대로 구현)]
const CATEGORY_ICONS = [
  { icon: Sofa, label: 'Living Room' },
  { icon: Bed, label: 'Bedroom' },
  { icon: Table, label: 'Dining Room' },
  { icon: Monitor, label: 'Office' },
  { icon: Trees, label: 'Outdoor' },
  { icon: Archive, label: 'Storage' },
  { icon: Lamp, label: 'Lighting' },
  { icon: Palette, label: 'Decor' }
];

// 최상단 히어로 5초 롤링 크로스페이드 전용 5대 프리미엄 인테리어 화보 리스트 (가로 1600px급 Unsplash 라이선스-프리)
const HERO_ROTATION_IMAGES = [
  '/zen_living_room.png', // 1. 오리지널 아치형 젠 룸 화보
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80', // 2. 아늑하고 우아한 프렌치 쉐브론 리빙룸 화보
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80', // 3. 빛이 쏟아지는 모던 내추럴 힐링 룸 화보
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=80', // 4. 정갈한 미니멀 오트밀 샌드 룸 화보
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80'  // 5. 럭셔리 골드 크롬 대리석 리빙룸 화보
];

// 글로벌 가로 탑 네비게이션 바 컴포넌트 (시안 GNB 그대로 구현)
function TopNav({ activeTab, onTabClick, serverStatus, onRefreshHealth, sessionId, onOpenSessionModal }) {
  return (
    <header className="top-nav">
      <div className="top-nav-logo">ZIPPT</div>
      <nav className="top-nav-menu">
        <span 
          className={`top-nav-link ${activeTab === 'home' ? 'active' : ''}`} 
          onClick={() => onTabClick('home', 'home')}
        >
          Home
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'transform' ? 'active' : ''}`} 
          onClick={() => onTabClick('uploader-card', 'transform')}
        >
          AI Transform
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'editor' ? 'active' : ''}`} 
          onClick={() => onTabClick('editor-card', 'editor')}
        >
          Repair Studio
        </span>
        <span 
          className={`top-nav-link ${activeTab === 'gallery' ? 'active' : ''}`} 
          onClick={() => onTabClick('style-encyclopedia', 'gallery')}
        >
          28 Styles
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
  const [activeTab, setActiveTab] = useState('home'); // GNB active 탭 상태 부모 통합
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const [activeStyleId, setActiveStyleId] = useState(1); // 도감 탭 연동을 위한 전역 활성 스타일 ID
  const [startIndex, setStartIndex] = useState(0); // Featured Collections 카루셀 시작 인덱스 (모던=0으로 고정 기동)

  // 5초 간격 최상단 히어로 배경 롤링 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIndex(prev => (prev + 1) % HERO_ROTATION_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 클릭하여 해당 섹션으로 보정 오토 스크롤링 함수
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

  // 실시간 마우스 휠 스크롤 감지기 (ScrollSpy)
  useEffect(() => {
    const handleScrollSpy = () => {
      const scrollPos = window.scrollY;

      // 1. 최상단 홈 영역 판정
      if (scrollPos < 300) {
        setActiveTab('home');
        return;
      }

      const uploaderEl = document.getElementById('uploader-card');
      const editorEl = document.getElementById('editor-card');
      const galleryEl = document.getElementById('style-encyclopedia');

      const offset = 220; // 스크롤 판정 문턱값 (탑 내비바 80px + 여유폭 140px)

      // 각 작업 카드의 화면 내 스크롤 경계선 도출
      const uploaderTop = uploaderEl ? uploaderEl.getBoundingClientRect().top + window.scrollY - offset : Infinity;
      const editorTop = editorEl ? editorEl.getBoundingClientRect().top + window.scrollY - offset : Infinity;
      const galleryTop = galleryEl ? galleryEl.getBoundingClientRect().top + window.scrollY - offset : Infinity;

      // 아래에서부터 순차적으로 경계선을 넘었는지 체크하여 활성 탭 스위칭
      if (scrollPos >= galleryTop) {
        setActiveTab('gallery');
      } else if (scrollPos >= editorTop) {
        setActiveTab('editor');
      } else if (scrollPos >= uploaderTop) {
        setActiveTab('transform');
      }
    };

    window.addEventListener('scroll', handleScrollSpy);
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, []);

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

  // =====================================================================
  // [28가지 인테리어 가로 트랙 슬라이딩 슬라이더 핸들러]
  // =====================================================================
  // 화면에 4개의 카드가 동시에 보이므로, 최대 24번 인덱스까지만 이동 가능 (25 모듈러)
  const handleNextSlide = () => {
    setStartIndex(prev => (prev + 1) % 25);
  };

  const handlePrevSlide = () => {
    setStartIndex(prev => (prev - 1 + 25) % 25);
  };

  return (
    <div className="app-layout">
      {/* 최상단 글로벌 GNB 메뉴바 */}
      <TopNav
        activeTab={activeTab}
        onTabClick={handleScrollTo}
        serverStatus={serverStatus}
        onRefreshHealth={verifyServerHealth}
        sessionId={sessionId}
        onOpenSessionModal={() => setShowSessionModal(true)}
      />

      {/* 가로 100% 꽉 차는 메인 포트폴리오 작업 영역 */}
      <main className="main-content">
        
        {/* 전체 화면 시네마틱 히어로 섹션 (5장 크로스페이드 카루셀 연동, 창 내부 교체) */}
        <section className="hero-fullscreen" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* 5개 이미지 크로스페이드(Crossfade) 레이어 */}
          {HERO_ROTATION_IMAGES.map((imgUrl, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `url(${imgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: '8% center',
                backgroundRepeat: 'no-repeat',
                opacity: heroImageIndex === index ? 1 : 0,
                transition: 'opacity 1.5s ease-in-out', // 1.5초 동안 부드럽게 겹쳐지며 페이드 전환
                zIndex: 1
              }}
            />
          ))}

          <div className="hero-overlay" style={{ zIndex: 2, position: 'relative' }}>
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

        {/* [가구 카테고리 퀵 링크 아이콘 영역: 웜 샌드 미니멀리즘 데코] */}
        <section className="category-icons-section">
          <div className="category-icons-container">
            {CATEGORY_ICONS.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={index} className="category-icon-item">
                  <div className="category-icon-circle">
                    <IconComponent size={22} strokeWidth={1.5} />
                  </div>
                  <span className="category-icon-label">{item.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* [28가지 인테리어 가로 트랙 슬라이딩 슬라이더 Featured Collections 큐레이션 카드] */}
        <section className="featured-collections-section">
          <div className="featured-header">
            <span className="featured-sub">Curated For You</span>
            <h2 className="featured-title">Featured Collections</h2>
          </div>
          <div className="featured-carousel-wrapper">
            {/* 왼쪽 화살표 버튼 */}
            <button 
              className="carousel-arrow prev" 
              onClick={handlePrevSlide}
              aria-label="Previous styles"
            >
              <ChevronLeft size={24} />
            </button>

            {/* 움직이는 카드들을 담는 윈도우 뷰포트 */}
            <div className="featured-carousel-viewport">
              {/* 실제 translateX로 스무스하게 이동하는 가로 기차 레일 트랙 */}
              <div 
                className="featured-carousel-track"
                style={{
                  transform: `translateX(calc(-${startIndex} * (25% + 6px)))`
                }}
              >
                {STYLE_DATABASE.map((style) => (
                  <div 
                    key={style.id} 
                    className="featured-card"
                    onClick={() => {
                      // 카드 클릭 시 하단 28 Styles 도감으로 순간이동하고 클릭한 탭이 즉시 켜짐
                      setActiveStyleId(style.id);
                      document.getElementById('style-encyclopedia')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <div className="featured-card-img-wrapper">
                      {style.imageUrl ? (
                        <img src={style.imageUrl} alt={style.name} className="featured-card-img" />
                      ) : (
                        <div className="featured-card-no-img">No Image</div>
                      )}
                    </div>
                    <div className="featured-card-body">
                      <h3 className="featured-card-title">{style.name}</h3>
                      <span className="featured-card-link">Explore Style &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽 화살표 버튼 */}
            <button 
              className="carousel-arrow next" 
              onClick={handleNextSlide}
              aria-label="Next styles"
            >
              <ChevronRight size={24} />
            </button>
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

        {/* 28대 인테리어 스타일 도감 전시장 (GNB 28 Styles 메뉴 매핑) */}
        <StyleEncyclopedia activeId={activeStyleId} setActiveId={setActiveStyleId} />

        {/* 하단 럭셔리 브랜드 푸터 (NÜMA 시안 감성 완벽 재현) */}
        <footer style={{
          borderTop: '1px solid var(--border-color)',
          padding: '64px 0 48px',
          backgroundColor: '#FFFFFF',
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 10%',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 2.5fr',
            gap: '40px',
            alignItems: 'start'
          }}>
            {/* 1. 로고 & 카피라이트 */}
            <div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.15em', margin: '0 0 12px', fontFamily: 'Outfit, sans-serif' }}>
                ZIPPT
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.6', margin: '0 0 16px', fontWeight: '500' }}>
                An AI-powered interior curation platform designed to transform your space with 28 diverse styling guides.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: '1.6', margin: 0 }}>
                &copy; 2026 ZIPPT. All rights reserved.
              </p>
            </div>

            {/* 2. SERVICES 칼럼 */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
                Services
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <li><a href="#uploader-card" style={{ color: 'var(--text-light)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-light)'}>AI Transform</a></li>
                <li><a href="#editor-card" style={{ color: 'var(--text-light)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-light)'}>Repair Studio</a></li>
                <li><a href="#style-encyclopedia" style={{ color: 'var(--text-light)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-light)'}>28 Styles Guide</a></li>
              </ul>
            </div>

            {/* 3. COMPANY 칼럼 */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
                Company
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>About Us</span></li>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>Contact</span></li>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>FAQs</span></li>
              </ul>
            </div>

            {/* 4. FOLLOW US 칼럼 */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
                Follow Us
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>Instagram</span></li>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>Pinterest</span></li>
                <li><span style={{ color: 'var(--text-light)', cursor: 'default' }}>Facebook</span></li>
              </ul>
            </div>

            {/* 5. NEWSLETTER 칼럼 */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
                Newsletter
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', lineHeight: '1.6', margin: '0 0 16px' }}>
                Subscribe to get updates on new styles and more.
              </p>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    borderRadius: '0'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 18px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                    transition: 'background-color 0.2s',
                    borderRadius: '0'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#333333'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#000000'}
                >
                  SUBSCRIBE
                </button>
              </form>
            </div>
          </div>
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
