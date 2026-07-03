import React, { useState, useEffect } from 'react';
import stylesDb from './styles_db.json'; // 28가지 DB 한글 원본 스타일 DB 탑재

// 5가지 공간 카테고리 아이콘 정의 — 감성 가구 일러스트 스타일 SVG (주방, 화장실 추가)
const CATEGORY_ICONS = [
  {
    key: '침대',
    label: '침대',
    svg: (
      // 더블 침대 + 헤드보드 + 베개 2개 형태
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 28V16a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v12" />
        <rect x="6" y="28" width="36" height="10" rx="2" />
        <rect x="11" y="20" width="10" height="7" rx="2" />
        <rect x="27" y="20" width="10" height="7" rx="2" />
        <line x1="10" y1="38" x2="10" y2="42" />
        <line x1="38" y1="38" x2="38" y2="42" />
      </svg>
    )
  },
  {
    key: '소파',
    label: '소파',
    svg: (
      // 3인 소파 + 팔걸이 + 쿠션 형태
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 26V18a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v8" />
        <rect x="8" y="26" width="32" height="10" rx="2" />
        <rect x="5" y="22" width="5" height="14" rx="2" />
        <rect x="38" y="22" width="5" height="14" rx="2" />
        <line x1="24" y1="26" x2="24" y2="36" />
        <line x1="12" y1="36" x2="12" y2="41" />
        <line x1="36" y1="36" x2="36" y2="41" />
      </svg>
    )
  },
  {
    key: '주방',
    label: '주방',
    svg: (
      // 주방 싱크대 + 환풍 후드 조리대 일러스트
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
      // 모던한 스탠딩 욕조 + 샤워기 수전 일러스트
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22h32v12a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V22z" />
        <path d="M34 22V8a2 2 0 0 0-2-2h-4" />
        <circle cx="28" cy="8" r="2" />
        <line x1="28" y1="13" x2="28" y2="15" strokeDasharray="1 1" />
      </svg>
    )
  },
  {
    key: '오브제',
    label: '오브제',
    svg: (
      // 감성 화병 오브제 형태
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 40 Q14 34 16 26 Q18 18 24 18 Q30 18 32 26 Q34 34 30 40 Z" />
        <line x1="19" y1="18" x2="29" y2="18" />
        <line x1="24" y1="18" x2="24" y2="10" />
        <path d="M24 10 Q20 6 17 8" />
        <path d="M24 10 Q28 6 31 8" />
        <circle cx="17" cy="8" r="2" />
        <circle cx="31" cy="8" r="2" />
        <circle cx="24" cy="6" r="2" />
        <line x1="16" y1="40" x2="32" y2="40" />
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

export default function StyleEncyclopedia({ activeId, setActiveId }) {
  const [selectedCategory, setSelectedCategory] = useState(null); // 선택된 카테고리 필터 (null = 전체)

  const activeStyle = STYLE_DATABASE.find(item => item.id === activeId) || STYLE_DATABASE[0];

  // 사용자가 도감 하단 태그를 직접 클릭했을 때의 핸들러
  const handleTabSelect = (id) => {
    setActiveId(id);      // 부모 상태에 선택된 스타일 ID 전달
  };

  return (
    <section id="style-encyclopedia" className="style-encyclopedia-section" style={{
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      backgroundColor: '#FCFAF7',
      padding: '80px 10%',
      borderTop: '1px solid var(--border-color)',
      fontFamily: 'Outfit, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '40px'
    }}>
      
      {/* 타이틀 헤더 */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          📖 Style Encyclopedia
        </span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--primary)', marginTop: '6px', fontFamily: 'Outfit, sans-serif' }}>
          28가지 인테리어 취향 스타일 도감
        </h2>
      </div>

      {/* 시안 재현: 가로 2분할 럭셔리 매칭 레이아웃 (50% : 50% 구도) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '4.5fr 5.5fr', // 시안 비율인 45% : 55% 황금 분할
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(43,53,48,0.05)',
        height: '520px', // 세로 규격을 완전히 고정하여 틀이 꿀렁이며 움직이는 현상 완벽 방지
        backgroundColor: '#FCFAF7'
      }}>
        
        {/* 1. 좌측 웜 샌드 텍스트 패널 */}
        <div style={{
          backgroundColor: '#F1EAE4', // 시안의 부드러운 오트밀 베이지색 재현
          padding: '56px 56px 130px',  // 하단 130px: 아이콘 영역 확보용
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '24px',
          position: 'relative'
        }}>


          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Style No. {activeStyle.id}
            </span>
            <h3 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)', marginTop: '8px', marginBottom: '0', fontFamily: 'Outfit, sans-serif' }}>
              {activeStyle.name}
            </h3>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-light)', fontWeight: '400', fontFamily: 'Outfit, sans-serif', display: 'block', marginTop: '4px' }}>
              {activeStyle.engName}
            </span>
          </div>

          <p style={{
            fontSize: '1.1rem',
            color: 'var(--text-main)',
            lineHeight: '1.7',
            margin: 0,
            fontFamily: 'Outfit, sans-serif',
            fontWeight: '400',
            textAlign: 'left'
          }}>
            {activeStyle.desc}
          </p>

          <div style={{ borderTop: '1px solid #CDBCB2', paddingTop: '20px', width: '100%' }}>
            <span style={{ fontSize: '0.8rem', color: '#4E4844', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              선호 타겟층
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary)' }}>
              {activeStyle.target}
            </span>
          </div>

          {/* ── 공간 카테고리 아이콘 (좌측 하단 고정) ── */}
          <div style={{
            position: 'absolute',
            bottom: '28px',
            left: '56px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#9A8B84',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '2px'
            }}>공간 카테고리</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {CATEGORY_ICONS.map(cat => {
                // 이 스타일이 해당 카테고리를 포함하는지 확인
                const hasCategory = (activeStyle.categories || []).includes(cat.key);
                // 현재 선택된 카테고리와 일치하는지
                const isSelected = selectedCategory === cat.key;

                return (
                  <button
                    key={cat.key}
                    title={cat.label}
                    onClick={() => setSelectedCategory(prev => prev === cat.key ? null : cat.key)}
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
            {/* 선택 시 해당 카테고리 보유 여부 안내 */}
            {selectedCategory && (
              <span style={{
                fontSize: '0.72rem',
                color: (activeStyle.categories || []).includes(selectedCategory)
                  ? 'var(--accent)'
                  : '#BEB0AA',
                fontWeight: '600',
                marginTop: '2px'
              }}>
                {(activeStyle.categories || []).includes(selectedCategory)
                  ? `✔ ${activeStyle.name}에 어울리는 ${selectedCategory} 카테고리`
                  : `✗ 이 스타일의 주요 카테고리가 아닙니다`
                }
              </span>
            )}
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
            // 선택된 카테고리의 이미지가 존재하면 해당 DB 이미지 URL을 직접 노출, 없으면 대표 스타일 이미지 노출
            const displayUrl = selectedCategory && activeStyle.images && activeStyle.images[selectedCategory]
              ? activeStyle.images[selectedCategory]
              : activeStyle.imageUrl;

            return displayUrl ? (
              <img
                key={`${activeStyle.id}_${selectedCategory || 'default'}`} // key를 변경하여 React가 새로운 컴포넌트로 인식해 Fade 효과 발동
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

      {/* 하단 28가지 스타일 태그 네비게이터 (그리드 정렬 완료) */}
      <div>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>
            원하시는 스타일을 클릭해 보세요. 오토플레이가 멈추고 해당 스타일이 고정됩니다.
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)', // 7열 고정하여 4줄로 칼같이 칸 맞춤
          gap: '10px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          backgroundColor: '#FCFAF7',
          boxShadow: '0 8px 24px rgba(43,53,48,0.02)'
        }}>
          {STYLE_DATABASE.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabSelect(item.id)}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: '30px',
                border: activeId === item.id ? 'none' : '1px solid var(--border-color)',
                backgroundColor: activeId === item.id ? 'var(--primary)' : '#FCFAF7',
                color: activeId === item.id ? '#FCFAF7' : 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                if (activeId !== item.id) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-inner)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeId !== item.id) {
                  e.currentTarget.style.backgroundColor = '#FCFAF7';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
