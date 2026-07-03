import React, { useState, useEffect } from 'react';
import imagesMap from './styles_images.json'; // 28가지 DB 한글 원본 이미지 맵 탑재

// 스타일별 공간 카테고리 매핑 (침대방/소파/조명/오브제)
const STYLE_CATEGORIES = {
  1:  ['소파', '조명', '오브제'],         // 모던
  2:  ['침대', '소파', '조명'],           // 미니멀
  3:  ['침대', '소파', '오브제'],         // 북유럽
  4:  ['소파', '조명', '오브제'],         // 인더스트리얼
  5:  ['침대', '소파', '오브제'],         // 내추럴
  6:  ['침대', '소파', '오브제'],         // 빈티지
  7:  ['침대', '소파', '조명'],           // 클래식
  8:  ['침대', '소파', '조명', '오브제'], // 럭셔리
  9:  ['침대', '조명', '오브제'],         // 젠 스타일
  10: ['소파', '조명', '오브제'],         // 레트로
  11: ['침대', '소파', '오브제'],         // 보헤미안
  12: ['침대', '소파', '조명'],           // 프로방스
  13: ['침대', '소파', '오브제'],         // 프렌치
  14: ['침대', '조명', '오브제'],         // 오리엔탈
  15: ['소파', '조명', '오브제'],         // 에스닉
  16: ['소파', '조명', '오브제'],         // 미드센추리 모던
  17: ['소파', '조명', '오브제'],         // 컨템포러리
  18: ['침대', '소파', '오브제'],         // 러스틱
  19: ['소파', '조명', '오브제'],         // 아트데코
  20: ['침대', '소파', '오브제'],         // 셔비 시크
  21: ['소파', '조명', '오브제'],         // 어반 모던
  22: ['침대', '소파', '오브제'],         // 재팬디
  23: ['소파', '조명', '오브제'],         // 코스탈
  24: ['소파', '조명', '오브제'],         // 모로칸
  25: ['침대', '소파', '조명', '오브제'], // 글램
  26: ['침대', '소파', '오브제'],         // 그랜밀레니얼
  27: ['소파', '조명', '오브제'],         // 바우하우스
  28: ['침대', '소파', '조명', '오브제']  // 에클레틱
};

// 4가지 카테고리 아이콘 정의 — 감성 가구 일러스트 스타일 SVG
const CATEGORY_ICONS = [
  {
    key: '침대',
    label: '침대',
    svg: (
      // 더블 침대 + 헤드보드 + 베개 2개 형태
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* 헤드보드 */}
        <path d="M8 28V16a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v12" />
        {/* 매트리스 */}
        <rect x="6" y="28" width="36" height="10" rx="2" />
        {/* 베개 왼쪽 */}
        <rect x="11" y="20" width="10" height="7" rx="2" />
        {/* 베개 오른쪽 */}
        <rect x="27" y="20" width="10" height="7" rx="2" />
        {/* 다리 */}
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
        {/* 소파 등받이 */}
        <path d="M10 26V18a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v8" />
        {/* 좌석 쿠션 */}
        <rect x="8" y="26" width="32" height="10" rx="2" />
        {/* 왼쪽 팔걸이 */}
        <rect x="5" y="22" width="5" height="14" rx="2" />
        {/* 오른쪽 팔걸이 */}
        <rect x="38" y="22" width="5" height="14" rx="2" />
        {/* 쿠션 경계선 */}
        <line x1="24" y1="26" x2="24" y2="36" />
        {/* 다리 */}
        <line x1="12" y1="36" x2="12" y2="41" />
        <line x1="36" y1="36" x2="36" y2="41" />
      </svg>
    )
  },
  {
    key: '조명',
    label: '조명',
    svg: (
      // 펜던트 램프 (천장 행잉 조명) 형태
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* 천장 고정부 */}
        <line x1="24" y1="4" x2="24" y2="12" />
        <line x1="18" y1="4" x2="30" y2="4" />
        {/* 갓 (쉐이드) */}
        <path d="M14 24 L18 12 L30 12 L34 24 Z" />
        {/* 갓 하단 */}
        <line x1="14" y1="24" x2="34" y2="24" />
        {/* 전구 */}
        <circle cx="24" cy="28" r="3" />
        {/* 빛 효과 */}
        <path d="M16 36 Q24 32 32 36" strokeDasharray="2 2" opacity="0.5" />
        <path d="M12 40 Q24 35 36 40" strokeDasharray="2 2" opacity="0.3" />
      </svg>
    )
  },
  {
    key: '오브제',
    label: '오브제',
    svg: (
      // 꽃병 + 꽃가지 형태 (인테리어 오브제의 전형)
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* 꽃병 몸통 */}
        <path d="M18 40 Q14 34 16 26 Q18 18 24 18 Q30 18 32 26 Q34 34 30 40 Z" />
        {/* 꽃병 입구 */}
        <line x1="19" y1="18" x2="29" y2="18" />
        {/* 꽃줄기 */}
        <line x1="24" y1="18" x2="24" y2="10" />
        <path d="M24 10 Q20 6 17 8" />
        <path d="M24 10 Q28 6 31 8" />
        {/* 꽃봉오리 */}
        <circle cx="17" cy="8" r="2.5" />
        <circle cx="31" cy="8" r="2.5" />
        <circle cx="24" cy="6" r="3" />
        {/* 바닥 */}
        <line x1="16" y1="40" x2="32" y2="40" />
      </svg>
    )
  }
];

// DB1.csv에서 파싱된 28가지 인테리어 스타일 데이터의 대표 정제 맵
const STYLE_DATABASE_RAW = [
  { id: 1, name: "모던", engName: "Modern", desc: "직선 위주의 군더더기 없는 세련미와 심플함", target: "2030 직장인" },
  { id: 2, name: "미니멀", engName: "Minimal", desc: "필요한 것만 정제해 여백의 미를 극대화한 비움", target: "1인 가구, 미니멀리스트" },
  { id: 3, name: "북유럽", engName: "Scandinavian", desc: "따뜻한 라이트 우드와 자연광이 녹아든 아늑함", target: "신혼부부, 아이가 있는 집" },
  { id: 4, name: "인더스트리얼", engName: "Industrial", desc: "노출 콘크리트와 거친 파이프, 철제가 만드는 빈티지 시크", target: "카페형 홈스타일 선호족" },
  { id: 5, name: "내추럴", engName: "Natural", desc: "자연 나뭇결을 살린 원목 가구와 식물의 조화로운 힐링", target: "자연 친화적 치유를 원하는 이" },
  { id: 6, name: "빈티지", engName: "Vintage", desc: "시간의 기품이 고스란히 서린 앤티크 수제 가구의 낭만", target: "레트로 컬렉터 및 예술가" },
  { id: 7, name: "클래식", engName: "Classic", desc: "웅장한 웨인스코팅 몰딩과 화려한 샹들리에의 품격", target: "럭셔리 대형 평수 가구" },
  { id: 8, name: "럭셔리", engName: "Luxury", desc: "천연 대리석 and 골드 크롬 몰딩이 빚어내는 리조트 감성", target: "고소득 가구, 하이엔드 펜트하우스" },
  { id: 9, name: "젠 스타일", engName: "Zen", desc: "동양적 절제미와 대나무, 분재정원이 제안하는 평온한 사색", target: "명상과 마음의 정돈을 바라는 이" },
  { id: 10, name: "레트로", engName: "Retro", desc: "7080 비비드 팝 원색 컬러와 볼드한 기하학 카펫 매치", target: "개성 넘치는 아트 디렉터" },
  { id: 11, name: "보헤미안", engName: "Bohemian", desc: "자유로운 이국적 패턴의 에스닉 마크라메 소품 데코", target: "자유분방한 무이의 여행가" },
  { id: 12, name: "프로방스", engName: "Provence", desc: "프랑스 남부 파스텔 허브 정원의 아기자기한 시골 낭만", target: "친근한 전원 생활을 지향하는 이" },
  { id: 13, name: "프렌치", engName: "French", desc: "파리 샹젤리제 로맨틱 하우스의 부드러운 쉐브론 마루", target: "로맨틱 감성을 원하는 신혼 가구" },
  { id: 14, name: "오리엔탈", engName: "Oriental", desc: "전통 한옥 한지벽지와 격자 창호 문양의 고풍스러운 단아함", target: "다도를 사랑하는 부모님 세대" },
  { id: 15, name: "에스닉", engName: "Ethnic", desc: "아프리카와 남미 점토 벽면에서 영감을 얻은 원초적 수공예", target: "공예품 애호가, 예술 수집가" },
  { id: 16, name: "미드센추리 모던", engName: "Mid-Century Modern", desc: "철제 프레임과 코발트 블루 원색 가죽의 바우하우스적 매칭", target: "트렌디한 감각의 크리에이터" },
  { id: 17, name: "컨템포러리", engName: "Contemporary", desc: "유선형의 입체 조형 소파 가구와 가장 트렌디한 현대적 선형미", target: "유행을 리드하는 2030 세대" },
  { id: 18, name: "러스틱", engName: "Rustic", desc: "거친 통나무 들보와 가공되지 않은 돌벽의 날것 그대로의 미학", target: "자연 별장 및 타운하우스 가구" },
  { id: 19, name: "아트데코", engName: "Art Deco", desc: "화려한 재즈 시대의 황금 기하학 패턴과 버건디 색상 매치", target: "극강의 화려함을 추구하는 가구" },
  { id: 20, name: "셔비 시크", engName: "Shabby Chic", desc: "빛바랜 로즈 플라워 패턴과 페인트가 까진 화이트 가구 낭만", target: "앤티크 린넨 선호 1인 가구" },
  { id: 21, name: "어반 모던", engName: "Urban Modern", desc: "대도시 통유리 오피스텔 빌딩의 시크한 모노톤 챠콜 전망", target: "도회적인 라이프스타일을 사랑하는 이" },
  { id: 22, name: "재팬디", engName: "Japandi", desc: "동양의 비움과 북유럽 스칸디나비아 실용성의 이상적 하이브리드", target: "단정하고 포근한 실용 미학 선호자" },
  { id: 23, name: "코스탈", engName: "Coastal", desc: "지중해 산토리니의 청량한 블루와 시원한 마 소재 데코레이션", target: "여름 휴양지의 아늑함을 원할 때" },
  { id: 24, name: "모로칸", engName: "Moroccan", desc: "모로코 테라코타 아치 게이트와 에스닉 모자이크 타일 미학", target: "이국적이고 신비로운 개성 가구" },
  { id: 25, name: "글램", engName: "Glam", desc: "유광 하이글로시 거울 도어와 고급 벨벳 가구의 매혹적 반사", target: "호캉스 무드의 반짝임을 원하는 세대" },
  { id: 26, name: "그랜밀레니얼", engName: "Grandmillennial", desc: "할머니 꽃무늬 프릴 벽지와 뜨개질 카펫의 뉴트로 감성", target: "레트로 꽃무늬를 좋아하는 크리에이터" },
  { id: 27, name: "바우하우스", engName: "Bauhaus", desc: "형태는 기능을 따른다, 1920년대 독일 기하학 스틸 파이프 가구", target: "건축/디자인 전문직 및 교수층" },
  { id: 28, name: "에클레틱", engName: "Eclectic", desc: "서로 다른 역사적 시대의 가구들이 빚어내는 경이로운 조화", target: "디자이너 및 패션 믹스매치 마니아" }
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
export const STYLE_DATABASE = STYLE_DATABASE_RAW.map(item => ({
  ...item,
  imageUrl: getHighResImageUrl(item.name, imagesMap[item.name])
}));

export default function StyleEncyclopedia({ activeId, setActiveId }) {
  const [isAutoPlay, setIsAutoPlay] = useState(true); // 도감 5초 자동 롤링 활성화 여부
  const [selectedCategory, setSelectedCategory] = useState(null); // 선택된 카테고리 필터 (null = 전체)

  // 5초 간격으로 자동 회전 (사용자가 직접 클릭하지 않았을 때만 활성화)
  useEffect(() => {
    if (!isAutoPlay) return;

    const timer = setInterval(() => {
      setActiveId(prevId => {
        const nextId = prevId + 1;
        return nextId > STYLE_DATABASE.length ? 1 : nextId;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlay, setActiveId]);

  const activeStyle = STYLE_DATABASE.find(item => item.id === activeId) || STYLE_DATABASE[0];

  // 사용자가 도감 하단 태그를 직접 클릭했을 때의 핸들러
  const handleTabSelect = (id) => {
    setIsAutoPlay(false); // 사용자가 직접 탐색 시 오토플레이 정지 (사용자 경험 보호)
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
          {/* 재생 상태 인디케이터 (오토플레이 활성화 시 부드럽게 점멸) */}
          <div style={{
            position: 'absolute',
            top: '24px',
            left: '56px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-light)',
            fontWeight: '600'
          }}>
            {isAutoPlay ? (
              <>
                <span className="badge-online" style={{ width: '8px', height: '8px', borderRadius: '50px', backgroundColor: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span>5초 자동 롤링 중</span>
              </>
            ) : (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50px', backgroundColor: '#CDBCB2', display: 'inline-block' }} />
                <span>수동 고정 모드</span>
              </>
            )}
          </div>

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
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '2px'
            }}>공간 카테고리</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {CATEGORY_ICONS.map(cat => {
                // 이 스타일이 해당 카테고리를 포함하는지 확인
                const hasCategory = (STYLE_CATEGORIES[activeStyle.id] || []).includes(cat.key);
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
                color: (STYLE_CATEGORIES[activeStyle.id] || []).includes(selectedCategory)
                  ? 'var(--accent)'
                  : '#BEB0AA',
                fontWeight: '600',
                marginTop: '2px'
              }}>
                {(STYLE_CATEGORIES[activeStyle.id] || []).includes(selectedCategory)
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
          {activeStyle.imageUrl ? (
            <img
              key={activeStyle.id} // key를 변경하여 React가 새로운 컴포넌트로 인식해 Fade 효과 발동
              src={activeStyle.imageUrl}
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
          )}
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
