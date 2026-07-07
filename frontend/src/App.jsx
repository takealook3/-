// =====================================================================
// [App.jsx: Streamlit 100% 동기화 + 부분 수선 Inpainting 통합 지휘관]
// =====================================================================
import React, { useState, useEffect, useCallback } from 'react';
import ErrorBanner from './components/ErrorBanner';
import ImageUploader from './components/ImageUploader';
// StyleSelector는 ChatWidget 통합으로 인해 제거되었습니다.
import ImageEditor from './components/ImageEditor';
import ComparisonGallery from './components/ComparisonGallery';
import SessionModal from './components/SessionModal';
import StyleTransformer from './components/StyleTransformer';
import ChatWidget from './components/ChatWidget';
import StyleEncyclopedia, { STYLE_DATABASE } from './components/StyleEncyclopedia';
import StyleQuiz from './components/StyleQuiz';
import FurnitureShopShowroom from './components/FurnitureShopShowroom';
import { checkHealth, sendChatMessage, API_BASE_URL } from './services/api';
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
          className={`top-nav-link ${activeTab === 'quiz' ? 'active' : ''}`} 
          onClick={() => onTabClick('quiz-section', 'quiz')}
        >
          Style Quiz
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

      </nav>
      <div className="top-nav-actions">
        {/* [신설] 상단 오른쪽 Shop 새 창 열기 버튼 */}
        <button 
          onClick={() => window.open(window.location.origin + window.location.pathname + '?page=shop', '_blank')} 
          className="btn btn-primary" 
          style={{ 
            padding: '8px 18px', 
            fontSize: '0.85rem', 
            borderRadius: '20px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            backgroundColor: 'var(--accent)',
            color: '#1C1714',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          🛍️ Shop
        </button>
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
  
  // [신설] ?page=shop 여부 판별 상태 추가
  const [isShopPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') === 'shop';
  });

  const [imageId, setImageId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [studioTab, setStudioTab] = useState('upload'); // 'upload' | 'repair' (통합 탭 상태)

  const [currentError, setCurrentError] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // GNB active 탭 상태 부모 통합
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [activeStyleId, setActiveStyleId] = useState(STYLE_DATABASE[0]?.id || 1);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0); // Featured Collections 카루셀 시작 인덱스 (모던=0으로 고정 기동)

  const [pendingPrompt, setPendingPrompt] = useState(''); // 취향 퀴즈 연동용 자동 프롬프트 상태
  const [quizPendingPrompt, setQuizPendingPrompt] = useState(''); // 퀴즈 결과 주입 전용 독립 프롬프트 상태
  
  // [신설] 스타일 변환 비동기 연산 부모 끌어올리기 상태들 (탭 전환 시에도 백그라운드 작업 및 비교 쇼룸 유지 보장)
  const [transformLoading, setTransformLoading] = useState(false);
  const [transformResultUrl, setTransformResultUrl] = useState(null);
  const [transformRawAnswer, setTransformRawAnswer] = useState('');
  const [transformSummary, setTransformSummary] = useState(null);
  // [수정] 숍 카테고리 초기값은 URL 파라미터에서 가져옴
  const [selectedShopCategory, setSelectedShopCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('category') || null;
  });

  // 5초 간격 최상단 히어로 배경 롤링 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIndex(prev => (prev + 1) % HERO_ROTATION_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleApplyQuizPrompt = (prompt) => {
    // 이미지 업로드 여부와 상관없이 추천 프롬프트를 세팅하고 변환 스튜디오로 이동합니다.
    setQuizPendingPrompt(prompt); // 퀴즈 결과는 챗봇이 아닌 스타일 변환 텍스트 입력창으로 독립 주입
    setActiveTab('transform');
    setStudioTab('upload');
    
    setTimeout(() => {
      const targetEl = document.getElementById('studio-section') || document.getElementById('uploader-card');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // 클릭하여 해당 섹션으로 보정 오토 스크롤링 함수
  const handleScrollTo = (id, tabName) => {
    setActiveTab(tabName);
    if (tabName === 'transform') {
      setStudioTab('upload');
    } else if (tabName === 'editor') {
      setStudioTab('repair');
    }

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

      const quizEl = document.getElementById('quiz-section');
      const uploaderEl = document.getElementById('uploader-card');

      const offset = 220; // 스크롤 판정 문턱값 (탑 내비바 80px + 여유폭 140px)

      // 각 작업 카드의 화면 내 스크롤 경계선 도출
      const quizTop = quizEl ? quizEl.getBoundingClientRect().top + window.scrollY - offset : Infinity;
      const uploaderTop = uploaderEl ? uploaderEl.getBoundingClientRect().top + window.scrollY - offset : Infinity;

      // 아래에서부터 순차적으로 경계선을 넘었는지 체크하여 활성 탭 스위칭
      if (scrollPos >= uploaderTop) {
        setActiveTab(studioTab === 'repair' ? 'editor' : 'transform');
      } else if (scrollPos >= quizTop) {
        setActiveTab('quiz');
      }
    };

    window.addEventListener('scroll', handleScrollSpy);
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [studioTab]);

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

  // AI 응답 텍스트를 분석하여 벽지, 자재, 스타일링으로 요약 분류하는 파서 헬퍼
  const parseInteriorRecommendation = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    
    const recs = {
      wallpaper: [],  // 벽지 추천
      materials: [],  // 자재 추천
      furniture: [],  // 가구/소품 추천
      general: []     // 종합 조언
    };

    lines.forEach(line => {
      const cleanLine = line.replace(/^[-*•\s\d.]+\s*/, '').trim();
      if (!cleanLine || cleanLine.length < 4) return;

      const lowerLine = cleanLine.toLowerCase();
      
      if (lowerLine.includes('벽지') || lowerLine.includes('도배') || lowerLine.includes('실크 벽지') || lowerLine.includes('페인트') || lowerLine.includes('벽면')) {
        recs.wallpaper.push(cleanLine);
      }
      else if (lowerLine.includes('자재') || lowerLine.includes('바닥') || lowerLine.includes('마루') || lowerLine.includes('원목') || lowerLine.includes('타일') || lowerLine.includes('대리석') || lowerLine.includes('석재')) {
        recs.materials.push(cleanLine);
      }
      else if (lowerLine.includes('가구') || lowerLine.includes('소파') || lowerLine.includes('테이블') || lowerLine.includes('의자') || lowerLine.includes('조명') || lowerLine.includes('카펫') || lowerLine.includes('러그') || lowerLine.includes('식물') || lowerLine.includes('화분')) {
        recs.furniture.push(cleanLine);
      }
      else {
        recs.general.push(cleanLine);
      }
    });

    return recs;
  };

  const handleTransformSubmitGlobal = async (promptText) => {
    if (!promptText || !promptText.trim() || transformLoading) return;

    setTransformLoading(true);
    setTransformResultUrl(null);
    setTransformRawAnswer('');
    setTransformSummary(null);
    setCurrentError(null);

    const getFullUrl = (url) => {
      if (!url) return "";
      if (url.startsWith("http://") || url.startsWith("https://")) return url;
      return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
    };

    try {
      const res = await sendChatMessage({
        sessionId: sessionId || "session_default",
        question: promptText.trim(),
        imageId: imageId
      });

      if (res.success) {
        const respData = res.data || {};
        const fullImg = getFullUrl(respData.image_url);
        setTransformResultUrl(fullImg);
        setTransformRawAnswer(respData.answer || "");
        
        const parsed = parseInteriorRecommendation(respData.answer);
        setTransformSummary(parsed);

        if (respData.result_id && handleGenerateSuccess) {
          handleGenerateSuccess({
            resultId: respData.result_id,
            resultImageUrl: fullImg,
            style: respData.style || "modern",
            prompt: promptText.trim(),
            processingTime: respData.processing_time || 0,
            status: "completed",
            recommendations: parsed
          });
        }
      } else {
        setCurrentError({
          errorCode: res.errorCode || "PROCESSING_FAILED",
          message: res.message || "스타일 변환 작업에 실패했습니다."
        });
      }
    } catch (err) {
      console.error(err);
      setCurrentError({
        errorCode: "SERVER_ERROR",
        message: `스타일 변환 통신 오류: ${err.message}`
      });
    } finally {
      setTransformLoading(false);
    }
  };

  // =====================================================================
  // [28가지 인테리어 가로 트랙 슬라이딩 슬라이더 핸들러]
  // =====================================================================
  // 한번에 4개의 카드가 통째로 이동하도록 설정 (28개 스타일 카드 기준 4개씩 순환) [캐러셀 한번에 4개씩 이동 처리]
  const handleNextSlide = () => {
    setStartIndex(prev => (prev + 4) % 28);
  };

  const handlePrevSlide = () => {
    setStartIndex(prev => (prev - 4 + 28) % 28);
  };

  // [신설] Shop 페이지(page=shop) 단독 렌더링을 위한 전용 럭셔리 레이아웃 분기
  if (isShopPage) {
    return (
      <div className="app-layout" style={{ backgroundColor: '#FCFAF7', minHeight: '100vh', color: '#2A2521' }}>
        {/* Shop 전용 상단 헤더 바 */}
        <header className="top-nav" style={{ position: 'static', marginBottom: '24px', backgroundColor: '#1C1714', color: '#FCFAF7' }}>
          {/* [수정] 클릭 시 쿼리 파라미터가 날아가 메인 스튜디오(Home)로 되돌아가는 로고 버튼화 */}
          <div 
            className="top-nav-logo" 
            onClick={() => window.location.href = window.location.origin + window.location.pathname}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title="홈 화면(스튜디오)으로 돌아가기"
          >
            ZIPPT SHOP
          </div>
          <div style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.05em' }}>
            Premium Furniture Curation
          </div>
        </header>
        {/* 가구 카탈로그 단독 렌더링 영역 */}
        <main className="main-content" style={{ padding: '40px 24px 80px', maxWidth: '1200px', margin: '0 auto', gap: '32px' }}>
          <FurnitureShopShowroom
            selectedCategory={selectedShopCategory}
            setSelectedCategory={setSelectedShopCategory}
            onSelectStyle={(styleId) => {
              // 새 탭 내에서는 도감 이동 대신 친절한 안내 알림
              alert(`이 상품은 도감 스타일 번호 ${styleId}번에 어울리는 매칭 가구입니다. 메인 스튜디오(Home) 창에서 확인하실 수 있습니다.`);
            }}
          />
        </main>
        
        {/* Shop 가도 챗봇은 항상 사용할 수 있도록 추가 마운트 */}
        <ChatWidget 
          sessionId={sessionId} 
          imageId={imageId}
          onError={setCurrentError}
          pendingPrompt={pendingPrompt}
          setPendingPrompt={setPendingPrompt}
        />
      </div>
    );
  }

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
            <p className="hero-subtitle" style={{ marginTop: '-8px' }}> {/* [위쪽 큰 글씨와 더 가깝게 밀착되도록 여백 조정] */}
              {/* 영문 부제목 행 간격 줄이기 [영문 행간격 축소] */}
              <span style={{ lineHeight: '1.3', display: 'block' }}>
                Discover timeless furniture and curated essentials designed for elevated spaces.
              </span>
              {/* 한국어 텍스트만 가독성 높이기 위해 글자 포인트를 줄이고 아이폰6 스타일의 얇은 폰트로 처리 [한국어 얇은 폰트 가독성 최적화] */}
              <span style={{ 
                display: 'block', 
                marginTop: '8px', /* [영문 텍스트 줄어든 행간에 비례해 마진 소폭 조정] */
                fontSize: '0.88rem', /* [글씨 포인트 작게 조정] */
                fontWeight: '300', /* [아이폰6 느낌의 얇은 폰트 두께 지정] */
                lineHeight: '1.7', 
                letterSpacing: '-0.02em' 
              }}>
                거실, 방, 침실 사진을 업로드하여 <strong>전면 리모델링(스타일 변환)</strong>을 하거나, 
                마우스 드래그로 <strong>특정 가구만 선택 교체(부분 수선)</strong>할 수 있는 AI 인테리어 스튜디오입니다.
              </span>
            </p>
            {/* 시안 이미지 속 2대 프리미엄 버튼의 실 작동 연동 */}
            <div className="hero-buttons">
              <button 
                onClick={() => window.open(window.location.origin + window.location.pathname + '?page=shop', '_blank')} /* [쇼핑몰 새 탭 이동 처리] */
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
                  transform: `translateX(calc(-1 * ${startIndex} * (var(--card-width) + var(--gap-width))))`
                }}
              >
                {STYLE_DATABASE.map((style) => (
                  <div 
                    key={style.id} 
                    className="featured-card"
                    style={{ cursor: 'default' }}
                  >
                    <div className="featured-card-img-wrapper">
                      {style.imageUrl ? (
                        <img src={style.imageUrl} alt={style.name} className="featured-card-img" />
                      ) : (
                        <div className="featured-card-no-img">No Image</div>
                      )}
                    </div>
                    <div className="featured-card-body">
                      <h3 className="featured-card-title">{String(style.id).padStart(2, '0')}. {style.name}</h3> {/* [스타일 번호 01. 형식으로 출력] */}
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

        {/* 온보딩 취향 진단 퀴즈 섹션 */}
        <section id="quiz-section" className="quiz-section-wrapper">
          <div className="section-header-centered">
            <span className="section-subtitle">Find Your Curation</span>
            {/* 글씨 크기를 아래의 대제목들과 일치하는 2.2rem으로 확장하고 어두운 배경 대비 흰색 적용 */}
            <h2 className="section-title text-glow" style={{ fontSize: '2.2rem', color: '#FCFAF7' }}>Style Quiz</h2>
          </div>
          <StyleQuiz onApplyPrompt={handleApplyQuizPrompt} />
        </section>

        {/* [럭셔리 가구 카테고리 퀵 카드 섹션 (소파, 침대, 오브제)] */}
        <section className="category-cards-section">
          <div className="featured-header" style={{ marginBottom: '8px' }}>
            <span className="featured-sub">Product Categories</span>
            {/* 밝은 흰색 배경에 맞추어 제목 글자색을 원래의 어두운 갈색(primary)으로 복구 */}
            <h2 className="featured-title" style={{ color: 'var(--primary)' }}>Shop by Category</h2>
          </div>
          <div className="category-cards-grid">
            {/* 1. 소파 - [숍 새 창 연결] */}
            <div className="category-card" onClick={() => {
              window.open(window.location.origin + window.location.pathname + '?page=shop&category=소파', '_blank');
            }}>
              <div className="category-card-img-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80" 
                  alt="Sofa" 
                  className="category-card-img" 
                />
              </div>
              <div className="category-card-body">
                <h3 className="category-card-title">Sofa</h3>
                <span className="category-card-explore">Explore &rarr;</span>
              </div>
            </div>
            {/* 2. 침대 - [숍 새 창 연결] */}
            <div className="category-card" onClick={() => {
              window.open(window.location.origin + window.location.pathname + '?page=shop&category=침대', '_blank');
            }}>
              <div className="category-card-img-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80" 
                  alt="Bed" 
                  className="category-card-img" 
                />
              </div>
              <div className="category-card-body">
                <h3 className="category-card-title">Bed</h3>
                <span className="category-card-explore">Explore &rarr;</span>
              </div>
            </div>
            {/* 3. 오브제 - [숍 새 창 연결] */}
            <div className="category-card" onClick={() => {
              window.open(window.location.origin + window.location.pathname + '?page=shop&category=오브제', '_blank');
            }}>
              <div className="category-card-img-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80" 
                  alt="Decor" 
                  className="category-card-img" 
                />
              </div>
              <div className="category-card-body">
                <h3 className="category-card-title">Decor</h3>
                <span className="category-card-explore">Explore &rarr;</span>
              </div>
            </div>
          </div>
        </section>

        {/* 에러 안내판 */}
        <ErrorBanner
          error={currentError}
          onClose={() => setCurrentError(null)}
          onRetry={currentError?.errorCode === "SERVER_CONNECTION_FAILED" ? verifyServerHealth : null}
        />

        {/* 통합 인테리어 편집 스튜디오 (탭 전환 구조) */}
        <div id="uploader-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 존재감 있는 AI 스튜디오 대형 헤더 타이틀 (Shop 카테고리 디자인과 일치시킴) */}
          <div className="featured-header" style={{ marginBottom: '8px', marginTop: '32px' }}>
            <span className="featured-sub">AI Space Curation</span>
            <h2 className="featured-title" style={{ color: '#FCFAF7' }}>Transform Your Space</h2>
          </div>

          {/* 애플 세그먼트 스타일의 미니멀 탭 컨트롤러 */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(0, 0, 0, 0.03)', // 은은하고 반투명한 애플식 배경
            padding: '5px', 
            borderRadius: '14px', 
            border: '1px solid var(--border-color)', 
            width: '100%', 
            maxWidth: '600px', 
            gap: '6px',
            alignSelf: 'center', 
            marginBottom: '12px', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            fontFamily: 'Outfit, sans-serif'
          }}>
            <button
              onClick={() => setStudioTab('upload')}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 0',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                // 선택 시 입체감 있는 흰색 카드 효과 적용
                background: studioTab === 'upload' ? 'var(--bg-card)' : 'transparent',
                color: studioTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: studioTab === 'upload' ? '0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.02)' : 'none',
                transform: studioTab === 'upload' ? 'translateY(-0.5px)' : 'none',
              }}
            >
              {imageId ? "🎨 스타일 변환" : "📸 사진 업로드"}
            </button>
            <button
              onClick={() => setStudioTab('repair')}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 0',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                // 선택 시 입체감 있는 흰색 카드 효과 적용
                background: studioTab === 'repair' ? 'var(--bg-card)' : 'transparent',
                color: studioTab === 'repair' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: studioTab === 'repair' ? '0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.02)' : 'none',
                transform: studioTab === 'repair' ? 'translateY(-0.5px)' : 'none',
              }}
            >
              🛠️ 부분 가구 교체
            </button>
          </div>

          {/* 탭 본문 렌더링 ( display: none 을 통한 컴포넌트 마운트 상시 유지 및 상태 보존 ) */}
          {!imageId ? (
            <ImageUploader
              imageId={imageId}
              sessionId={sessionId}
              originalImageUrl={originalImageUrl}
              onUploadSuccess={(data) => {
                handleUploadSuccess(data);
              }}
              onError={setCurrentError}
            />
          ) : (
            <div className="tab-contents-container">
              {/* 1. 스타일 변환 컴포넌트 (DOM을 유지하여 다른 탭 이동 시에도 진행 중인 AI 변환 백그라운드 상태 보존) */}
              <div style={{ display: studioTab === 'upload' ? 'block' : 'none' }}>
                <StyleTransformer
                  imageId={imageId}
                  sessionId={sessionId}
                  originalImageUrl={originalImageUrl}
                  onGenerateSuccess={handleGenerateSuccess}
                  onError={setCurrentError}
                  pendingPrompt={quizPendingPrompt}
                  setPendingPrompt={setQuizPendingPrompt}
                  onResetImage={() => {
                    setImageId(null);
                    setOriginalImageUrl(null);
                    setResultData(null);
                    setTransformResultUrl(null);
                    setTransformRawAnswer('');
                    setTransformSummary(null);
                  }}
                  onResetResult={() => {
                    setResultData(null);
                    setTransformResultUrl(null);
                    setTransformRawAnswer('');
                    setTransformSummary(null);
                  }}
                  globalLoading={transformLoading}
                  globalResultImageUrl={transformResultUrl}
                  globalRawAnswer={transformRawAnswer}
                  globalSummaryData={transformSummary}
                  onSubmitTransform={handleTransformSubmitGlobal}
                />
              </div>

              {/* 2. 부분 가구 교체 컴포넌트 (DOM을 유지하여 다른 탭 이동 시에도 마스킹/에디터 캔버스 상태 보존) */}
              <div id="editor-card" style={{ display: studioTab === 'repair' ? 'block' : 'none' }}>
                <ImageEditor
                  imageId={imageId}
                  sessionId={sessionId}
                  originalImageUrl={originalImageUrl}
                  onGenerateSuccess={handleGenerateSuccess}
                  onError={setCurrentError}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4단계: Before / After 비교 쇼룸 */}
        {resultData && (
          <div id="gallery-card">
            <ComparisonGallery
              originalImageUrl={originalImageUrl}
              resultData={resultData}
              onError={setCurrentError}
            />
          </div>
        )}

        {/* [메인에서 가구 카탈로그 제거 - Shop 버튼을 통해 새 창으로 제공됨] */}

        {/* 28가지 인테리어 취향 스타일 도감 섹션 */}
        <StyleEncyclopedia
          activeId={activeStyleId}
          setActiveId={setActiveStyleId}
          isModalOpen={isStyleModalOpen}
          setIsModalOpen={setIsStyleModalOpen}
        />



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


      {/* 5단계: AI 인테리어 취향 & 추구미 1:1 상담 메신저 위젯 (순수 인테리어 RAG 상담 전용) */}
      <ChatWidget 
        sessionId={sessionId} 
        imageId={imageId}
        onError={setCurrentError}
        pendingPrompt={pendingPrompt}
        setPendingPrompt={setPendingPrompt}
      />
    </div>
  );
}
