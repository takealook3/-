import React, { useState } from 'react';
import stylesDb from './styles_db.json'; // 28가지 DB 한글 원본 스타일 DB 탑재

// 3가지 공간 카테고리 아이콘 정의 — 감성 가구 일러스트 SVG (거실 추가, 주방/화장실만 유지)
const CATEGORY_ICONS = [
  {
    key: '거실',
    label: '거실',
    svg: (
      // 미니멀한 1인용 안락의자/라운지체어 형태 일러스트 [거실 카테고리 아이콘 정의]
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 26V18a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v8" />
        <rect x="8" y="26" width="32" height="10" rx="2" />
        <rect x="5" y="22" width="5" height="14" rx="2" />
        <rect x="38" y="22" width="5" height="14" rx="2" />
      </svg>
    )
  },
  {
    key: '주방',
    label: '주방',
    svg: (
      // 주방 싱크대 + 환풍 후드 조리대 일러스트 [주방 카테고리 아이콘 정의]
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="22" width="36" height="20" rx="2" />
        <circle cx="16" cy="32" r="4" />
        <circle cx="32" cy="32" r="4" />
        <path d="M12 10h24v6H12z" />
        <line x1="24" y1="4" x2="24" y2="10" />
      </svg>
    )
  },
  {
    key: '화장실',
    label: '화장실',
    svg: (
      // 모던한 스탠딩 욕조 + 샤워기 수전 일러스트 [화장실 카테고리 아이콘 정의]
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22h32v12a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V22z" />
        <path d="M34 22V8a2 2 0 0 0-2-2h-4" />
        <circle cx="28" cy="8" r="2" />
        <line x1="28" y1="13" x2="28" y2="15" strokeDasharray="1 1" />
      </svg>
    )
  }
];

// 초고해상도 럭셔리 인테리어 화보 Fallback 이미지 맵 (가로 1000px급 Unsplash 라이선스-프리)
const HIGH_RES_FALLBACK_IMAGES = {
  "모던": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=80",
  "미니멀": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=80",
  "북유럽": "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1000&q=80",
  "인더스트리얼": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80",
  "내추럴": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1000&q=80",
  "빈티지": "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1000&q=80",
  "클래식": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80",
  "럭셔리": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80",
  "젠 스타일": "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1000&q=80",
  "레트로": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1000&q=80",
  "보헤미안": "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=80",
  "프로방스": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80",
  "프렌치": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
  "오리엔탈": "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1000&q=80",
  "에스닉": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1000&q=80",
  "미드센추리 모던": "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1000&q=80",
  "컨템포러리": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80",
  "러스틱": "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
  "아트데코": "https://images.unsplash.com/photo-1506812779316-934cef51b42e?auto=format&fit=crop&w=1000&q=80",
  "셔비 시크": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80",
  "어반 모던": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80",
  "재팬디": "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1000&q=80",
  "코스탈": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80",
  "모로칸": "https://images.unsplash.com/photo-1532323544230-7191fd51bc1b?auto=format&fit=crop&w=1000&q=80",
  "글램": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=80",
  "그랜밀레니얼": "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1000&q=80",
  "바우하우스": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1000&q=80",
  "에클레틱": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80"
};

// 해상도 튜닝 및 폴백 오토 파서
const getHighResImageUrl = (name, rawUrl) => {
  if (HIGH_RES_FALLBACK_IMAGES[name]) {
    return HIGH_RES_FALLBACK_IMAGES[name];
  }
  if (!rawUrl || rawUrl.startsWith('data:image')) {
    return "";
  }
  let adjustedUrl = rawUrl;
  if (adjustedUrl.includes('w=292') || adjustedUrl.includes('w=200') || adjustedUrl.includes('w=115')) {
    adjustedUrl = adjustedUrl.replace(/w=\d+/, 'w=1000').replace(/h=\d+/, 'h=700');
  }
  return adjustedUrl;
};

// DB1.csv 이미지 맵을 동적으로 병합 (지능형 고해상도 처리탑재)
export const STYLE_DATABASE = stylesDb.map(item => ({
  ...item,
  imageUrl: getHighResImageUrl(item.name, item.imageUrl)
}));

export default function StyleDetailModal({ activeId, isModalOpen, setIsModalOpen }) {
  const [selectedCategory, setSelectedCategory] = useState('거실'); // 선택된 카테고리 필터 (기본값: 거실)

  if (!isModalOpen) return null;

  const activeStyle = STYLE_DATABASE.find(item => item.id === activeId) || STYLE_DATABASE[0];

  return (
    <div 
      onClick={() => setIsModalOpen(false)} /* [배경 클릭 시 모달 닫기] */
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(28, 23, 20, 0.6)', /* [어두운 브라운 딤 처리] */
        backdropFilter: 'blur(8px)', /* [배경 블러 처리] */
        zIndex: 100000, /* [최상단 팝업 배치] */
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()} /* [카드 내부 클릭 시 닫힘 방지] */
        style={{
          display: 'grid',
          gridTemplateColumns: '4.5fr 5.5fr', // 시안 비율인 45% : 55% 황금 분할
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          width: '900px', /* [모달 창 크기 고정] */
          height: '520px', 
          backgroundColor: '#FCFAF7',
          position: 'relative',
          animation: 'fadeInEffect 0.3s ease-out'
        }}
      >
        {/* 우측 상단 모달 닫기 버튼 [모달 닫기 버튼] */}
        <button
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid #CDBCB2',
            color: '#2A2521',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 10,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EAE5DF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; }}
          title="닫기"
        >
          ✕
        </button>
    
        {/* 1. 좌측 웜 샌드 텍스트 패널 */}
        <div style={{
          backgroundColor: '#F1EAE4', // 시안의 부드러운 오트밀 베이지색 재현
          padding: '36px 40px',  // [여백을 넉넉하게 재조정하여 세로 공간 확보]
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',  // [내부 요소들이 세로로 균등/스마트하게 배치되게 변경]
          alignItems: 'flex-start',
          position: 'relative',
          height: '100%'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Style No. {activeStyle.id}
            </span>
            <h3 style={{ fontSize: '2.1rem', fontWeight: '800', color: 'var(--primary)', marginTop: '6px', marginBottom: '0', fontFamily: 'Outfit, sans-serif' }}>
              {activeStyle.name}
            </h3>
            <span style={{ fontSize: '1.05rem', color: '#8C776A', fontWeight: '500', fontFamily: 'Outfit, sans-serif', display: 'block', marginTop: '2px' }}>
              {activeStyle.engName}
            </span>
          </div>

          <p style={{
            fontSize: '0.88rem', /* [가독성 향상을 위해 폰트 크기 축소] */
            color: 'var(--text-main)',
            lineHeight: '1.6',
            margin: 0,
            fontFamily: 'Outfit, sans-serif',
            fontWeight: '500', /* [약간 가독성 있는 두께] */
            letterSpacing: '-0.025em', /* [글자 자간 축소] */
            textAlign: 'left'
          }}>
            {activeStyle.desc}
          </p>

          <div style={{ borderTop: '1px solid #CDBCB2', paddingTop: '12px', width: '100%', marginTop: '4px' }}>
            <span style={{ fontSize: '0.85rem', color: '#4E4844', fontWeight: '800', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
              선호 타겟층
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', letterSpacing: '-0.025em' }}> {/* [가독성을 위해 폰트 축소 및 자간 축소] */}
              {activeStyle.target}
            </span>
          </div>

          {/* ── 공간 카테고리 아이콘 ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '16px',
            width: '100%'
          }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '800',
              color: '#4E4844',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '2px'
            }}>공간 카테고리</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {CATEGORY_ICONS.map(cat => {
                // 거실은 항상 참이며, 나머지는 기존 카테고리 데이터 체크
                const hasCategory = cat.key === '거실' ? true : (activeStyle.categories || []).includes(cat.key);
                // 현재 선택된 카테고리와 일치하는지
                const isSelected = selectedCategory === cat.key;

                return (
                  <button
                    key={cat.key}
                    title={cat.label}
                    onClick={() => setSelectedCategory(cat.key)} /* [카테고리 강제 설정] */
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '18px',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : hasCategory
                          ? '1.5px solid #CDBCB2'
                          : '1.5px dashed #D8CEC9',
                      backgroundColor: isSelected
                        ? 'var(--primary)'
                        : hasCategory
                          ? 'rgba(255,255,255,0.85)'
                          : 'rgba(235,228,224,0.4)',
                      color: isSelected
                        ? '#FCFAF7'
                        : hasCategory
                          ? 'var(--primary)'
                          : '#BEB0AA',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0',
                      padding: '0',
                      transition: 'all 0.22s ease',
                      backdropFilter: 'blur(4px)',
                      boxShadow: isSelected
                        ? '0 6px 20px rgba(43,53,48,0.22)'
                        : hasCategory
                          ? '0 2px 10px rgba(43,53,48,0.08)'
                          : 'none',
                      transform: isSelected ? 'translateY(-3px)' : 'none'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(43,53,48,0.14)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = hasCategory ? '0 2px 10px rgba(43,53,48,0.08)' : 'none';
                      }
                    }}
                  >
                    {cat.svg}
                    <span style={{ fontSize: '0.62rem', fontWeight: '700', marginTop: '4px' }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. 우측 16:9 와이드 화보 이미지 패널 */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          backgroundColor: '#EAE5DF'
        }}>
          {(() => {
            // 거실이거나 선택된 카테고리가 없으면 메인 이미지 노출, 주방/화장실은 해당 DB 이미지 노출
            const displayUrl = selectedCategory && selectedCategory !== '거실' && activeStyle.images && activeStyle.images[selectedCategory]
              ? activeStyle.images[selectedCategory]
              : activeStyle.imageUrl;

            return displayUrl ? (
              <img
                key={`${activeStyle.id}_${selectedCategory || 'default'}`} // key를 변경하여 React가 새로운 컴포넌트나 Fade 효과 인식
                src={displayUrl}
                alt={activeStyle.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  animation: 'fadeInEffect 0.8s ease-in-out'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-light)',
                fontSize: '0.9rem'
              }}>
                등록된 예시 이미지가 없습니다.
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
