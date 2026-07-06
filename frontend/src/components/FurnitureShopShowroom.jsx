import React, { useState, useEffect, useMemo, useRef } from 'react';
import stylesDb from './styles_db.json';

// 카테고리별 초고해상도 프리미엄 Unsplash 이미지 덤프 (스타일 분위기 일치를 위해 ID 기준 인덱싱)
const HIGH_RES_BED_IMAGES = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80", // 웜 우드 코지 베드
  "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80", // 모던 럭셔리 베드
  "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80", // 셰비 시크 아늑 침실
  "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80", // 스칸디나비안 라이트 베드
  "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80", // 미니멀 화이트 베드
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80", // 호텔식 럭셔리 베드
  "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=800&q=80", // 차분한 젠 베드룸
  "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=800&q=80"  // 프렌치 클래식 침대
];

const HIGH_RES_SOFA_IMAGES = [
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80", // 모던 그린 소파
  "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80", // 내추럴 웜 베이지 소파
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80", // 오렌지/옐로우 포인트 소파
  "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80", // 북유럽 패브릭 소파
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80", // 차분한 미드센추리 소파
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80", // 럭셔리 라운지 소파
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80", // 내추럴 원목 프레임 소파
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"  // 어반 모던 레더 소파
];

const HIGH_RES_OBJECT_IMAGES = [
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80", // 미니멀 도자기 화병
  "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=800&q=80", // 바우하우스 램프
  "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80", // 아티스틱 유리 화병
  "https://images.unsplash.com/photo-1506812779316-934cef51b42e?auto=format&fit=crop&w=800&q=80", // 빈티지 감성 조명
  "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80", // 레트로 턴테이블
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80", // 지중해풍 소품
  "https://images.unsplash.com/photo-1532323544230-7191fd51bc1b?auto=format&fit=crop&w=800&q=80", // 모로칸 랜턴
  "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80"  // 모던 메탈 오브제
];

// 저화질 구글 썸네일 검출 및 스마트 고화질 대체 필터
const resolveHighResImage = (category, url, id) => {
  // 1. URL이 비어있거나 구글 썸네일(gstatic.com / tbn:) 형태인 경우 Unsplash 고화질 맵으로 덮어씀
  if (!url || url.includes('gstatic.com') || url.includes('tbn:')) {
    const seed = id - 1; // 0-indexed로 일관성 매핑
    if (category === '침대') return HIGH_RES_BED_IMAGES[seed % HIGH_RES_BED_IMAGES.length];
    if (category === '소파') return HIGH_RES_SOFA_IMAGES[seed % HIGH_RES_SOFA_IMAGES.length];
    return HIGH_RES_OBJECT_IMAGES[seed % HIGH_RES_OBJECT_IMAGES.length];
  }
  
  // 2. 핀터레스트 등 일반 이미지 링크 중 해상도 강제 축소(w=292, w=200 등)가 있는 경우 1000px급으로 치환
  let adjustedUrl = url;
  if (adjustedUrl.includes('w=292') || adjustedUrl.includes('w=200') || adjustedUrl.includes('w=115')) {
    adjustedUrl = adjustedUrl.replace(/w=\d+/, 'w=1000').replace(/h=\d+/, 'h=700');
  }
  // 핀터레스트의 736x 규격을 1200x 규격으로 교체하여 디테일 향상
  if (adjustedUrl.includes('pinimg.com/736x/')) {
    adjustedUrl = adjustedUrl.replace('/736x/', '/1200x/');
  }
  
  return adjustedUrl;
};

// 가상의 럭셔리 가격 범위 책정용 헬퍼 (평당 단가를 바탕으로 정교한 연출)
const getVirtualPriceRange = (category, difficulty) => {
  let basePrice = 450000; // 기본 소품류
  if (category === '소파') basePrice = 2400000;
  if (category === '침대') basePrice = 1850000;

  // 난이도(럭셔리 지표)에 따른 프리미엄 가중치
  let multiplier = 1.0;
  if (difficulty === '보통') multiplier = 1.3;
  if (difficulty === '어려움') multiplier = 1.8;
  if (difficulty === '매우어려움') multiplier = 3.2;

  const finalPrice = Math.round((basePrice * multiplier) / 10000) * 10000;
  return finalPrice.toLocaleString('ko-KR') + " 원 ~";
};

export default function FurnitureShopShowroom({ onSelectStyle, selectedCategory, setSelectedCategory }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('style'); // 'style' | 'name'
  const [expandedCardId, setExpandedCardId] = useState(null); // 세부 정보 아코디언 상태
  
  const showroomRef = useRef(null);

  // 28가지 스타일 DB를 가구 카탈로그(소파, 침대, 오브제)로 플랫하게 파싱
  const allProducts = useMemo(() => {
    const products = [];
    stylesDb.forEach(style => {
      // 1. 소파
      if (style.images?.["소파"]) {
        products.push({
          id: `${style.id}_sofa`,
          styleId: style.id,
          styleName: style.name,
          category: '소파',
          title: "프리미엄 디자이너 소파",
          engName: `${style.engName} Edition Sofa`,
          desc: `${style.name} 무드에 맞춰 제작된 모던한 실루엣의 시그니처 소파입니다.`,
          imageUrl: resolveHighResImage('소파', style.images["소파"], style.id),
          target: style.target,
          difficulty: style.difficulty,
          price: getVirtualPriceRange('소파', style.difficulty),
          material: "이탈리아 탑 그레인 천연 가죽 / 친환경 고밀도 폼"
        });
      }
      // 2. 침대
      if (style.images?.["침대"]) {
        products.push({
          id: `${style.id}_bed`,
          styleId: style.id,
          styleName: style.name,
          category: '침대',
          title: "릴렉싱 원목/패브릭 침대",
          engName: `${style.engName} Relaxing Bed`,
          desc: `아늑한 ${style.name} 침실 환경을 조성해 주는 견고한 오크/패브릭 침대입니다.`,
          imageUrl: resolveHighResImage('침대', style.images["침대"], style.id),
          target: style.target,
          difficulty: style.difficulty,
          price: getVirtualPriceRange('침대', style.difficulty),
          material: "북미산 화이트 오크 원목 / 오코텍스 인증 방수 패브릭"
        });
      }
      // 3. 오브제 (소품) - [오브제1, 2, 3 모두 개별 상품 카드로 다중 팽창 적용]
      ["오브제1", "오브제2", "오브제3"].forEach((key, index) => {
        if (style.images?.[key]) {
          products.push({
            id: `${style.id}_object_${index + 1}`, /* [오브제 고유 ID 생성] */
            styleId: style.id,
            styleName: style.name,
            category: '오브제',
            title: `시그니처 오브제 컬렉션 0${index + 1}`,
            engName: `${style.engName} Decor Edition 0${index + 1}`,
            desc: `공간의 품격과 ${style.name} 무드를 완성하는 감성적인 테마 소품 0${index + 1}입니다.`,
            imageUrl: resolveHighResImage('오브제', style.images[key], style.id + index * 100), /* [고화질 대체 이미지 씨드 변경] */
            target: style.target,
            difficulty: style.difficulty,
            price: getVirtualPriceRange('오브제', style.difficulty),
            material: "수공예 파인 세라믹 / 샌드 피니시 메탈"
          });
        }
      });
    });
    return products;
  }, []);

  // 필터링 및 정렬 처리
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter(prod => {
        // 1. 카테고리 필터
        if (selectedCategory && prod.category !== selectedCategory) return false;
        // 2. 검색어 필터
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchTitle = prod.title.toLowerCase().includes(query);
          const matchStyle = prod.styleName.toLowerCase().includes(query);
          const matchDesc = prod.desc.toLowerCase().includes(query);
          return matchTitle || matchStyle || matchDesc;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'name') {
          return a.title.localeCompare(b.title, 'ko');
        }
        return a.styleId - b.styleId; // 기본 스타일 번호 순 정렬
      });
  }, [allProducts, selectedCategory, searchQuery, sortOrder]);

  const handleCardToggle = (id) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  return (
    <section id="furniture-showroom" ref={showroomRef} className="card" style={{
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      backgroundColor: '#FCFAF7',
      padding: '80px 10%',
      borderTop: '1px solid var(--border-color)',
      fontFamily: 'Outfit, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '36px',
      color: '#2A2521'
    }}>
      {/* 쇼룸 타이틀 영역 */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          🛋️ Premium Furniture Showroom
        </span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--primary)', marginTop: '6px', fontFamily: 'Outfit, sans-serif' }}>
          스타일별 프리미엄 가구 카탈로그
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          28가지 취향 도감에 등록된 실제 소파, 침대, 오브제 컬렉션을 한눈에 모아보세요.
        </p>
      </div>

      {/* 스마트 쇼핑몰 필터 툴바 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '20px'
      }}>
        {/* 1. 카테고리 탭 버튼 그룹 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['전체', '소파', '침대', '오브제'].map(cat => {
            const isSelected = (!selectedCategory && cat === '전체') || (selectedCategory === cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === '전체' ? null : cat)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '30px',
                  border: isSelected ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--primary)' : '#FFFFFF',
                  color: isSelected ? '#FCFAF7' : 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(43,53,48,0.15)' : 'none'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 2. 검색 및 정렬 드롭다운 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="스타일 또는 가구 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 18px',
              borderRadius: '30px',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              outline: 'none',
              width: '220px',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main)'
            }}
          />
          
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              padding: '10px 36px 10px 18px',
              borderRadius: '30px',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <option value="style">스타일 고유 순</option>
            <option value="name">가구 이름 순</option>
          </select>
        </div>
      </div>

      {/* 제품 수 표시 */}
      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>검색 결과: 총 {filteredProducts.length}개의 컬렉션</span>
        {selectedCategory && (
          <span style={{ color: 'var(--accent)' }}>💡 gstatic 저화질 원본 썸네일이 고화질 Unsplash 화보로 자동 매핑되었습니다.</span>
        )}
      </div>

      {/* 쇼핑몰 갤러리 그리드 리스트 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '30px',
        marginTop: '10px'
      }}>
        {filteredProducts.length > 0 ? (
          filteredProducts.map(prod => {
            const isExpanded = expandedCardId === prod.id;
            return (
              <div
                key={prod.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 12px 32px rgba(43,53,48,0.03)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 20px 48px rgba(43,53,48,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(43,53,48,0.03)';
                }}
              >
                {/* 상품 이미지 프레임 */}
                <div style={{
                  width: '100%',
                  height: '240px',
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: '#EAE5DF'
                }}>
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.5s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  {/* 카테고리 라벨 플로팅 배지 */}
                  <span style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    backgroundColor: 'var(--primary)',
                    color: '#FCFAF7',
                    padding: '6px 12px',
                    borderRadius: '30px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                  }}>
                    {prod.category}
                  </span>
                </div>

                {/* 상품 설명 본문 */}
                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    {/* 스타일 명칭 태그 */}
                    {/* 상단 뱃지: 해시태그 대신 대괄호 스타일명으로 정돈 */}
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      [{prod.styleName}]
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary)', marginTop: '4px', lineHeight: '1.4' }}>
                      {prod.title}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5' }}>
                      {prod.desc}
                    </p>
                  </div>

                  {/* 가격 및 세부정보 접기/펴기 */}
                  <div style={{ borderTop: '1px solid #F1EAE4', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>가상 큐레이션가</span>
                        <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)' }}>
                          {prod.price}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleCardToggle(prod.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        {isExpanded ? '닫기 ▲' : '스펙 정보 ▼'}
                      </button>
                    </div>

                    {/* 확장 스펙 테이블 아코디언 */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '16px',
                        backgroundColor: '#FCFAF7',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #CDBCB2',
                        fontSize: '0.72rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        animation: 'fadeInEffect 0.3s ease'
                      }}>
                        <div>
                          <strong style={{ color: '#4E4844' }}>권장 자재:</strong> {prod.material}
                        </div>
                        <div>
                          <strong style={{ color: '#4E4844' }}>선호 타겟:</strong> {prod.target || "전 연령대"}
                        </div>
                        <div>
                          <strong style={{ color: '#4E4844' }}>인테리어 난이도:</strong> {prod.difficulty}
                        </div>
                      </div>
                    )}
                  </div>


                </div>
              </div>
            );
          })
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            padding: '80px 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            검색 결과에 맞는 가구 컬렉션이 없습니다. 다른 키워드로 검색해 보세요!
          </div>
        )}
      </div>
    </section>
  );
}
