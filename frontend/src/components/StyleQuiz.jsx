import React, { useState } from 'react';
import { STYLE_DATABASE } from './StyleEncyclopedia';
import { Sparkles, ArrowRight, RefreshCw, Copy, Check } from 'lucide-react';

// 8개 문항 데이터셋 정의 (QUIZ images 내의 15개 파일 매핑)
const QUIZ_QUESTIONS = [
  {
    id: 1,
    axis: 'space',
    title: '당신이 더 편안함을 느끼는 거실의 모습은?',
    optionA: {
      image: '/quiz_images/여백이 넉넉한 심플한 거실.jpg',
      label: '여백과 심플함',
      score: 1 // Minimal
    },
    optionB: {
      image: '/quiz_images/소품과 패턴이 가득한 거실.jpg',
      label: '풍성한 소품과 패턴',
      score: -1 // Maximal
    }
  },
  {
    id: 2,
    axis: 'space',
    title: '하루를 마무리하는 침실, 어떤 분위기를 선호하시나요?',
    optionA: {
      image: '/quiz_images/가구 개수를 최소화한 침실.jpg',
      label: '최소한의 가구로 정돈된 침실',
      score: 1 // Minimal
    },
    optionB: {
      image: '/quiz_images/다양한 소재를 믹스한 침실.jpg',
      label: '다양한 소재가 믹스된 아늑한 침실',
      score: -1 // Maximal
    }
  },
  {
    id: 3,
    axis: 'space',
    title: '벽면을 꾸민다면 어느 쪽에 더 마음이 가시나요?',
    optionA: {
      image: '/quiz_images/무채색 위주 톤온톤.jpg',
      label: '차분한 무채색의 톤온톤 구성',
      score: 1 // Minimal
    },
    optionB: {
      image: '/quiz_images/포인트 컬러가 강한 벽면.jpg',
      label: '시선을 사로잡는 선명한 컬러 포인트',
      score: -1 // Maximal
    }
  },
  {
    id: 4,
    axis: 'tone',
    title: '공간을 감싸는 전체적인 톤, 당신의 선택은?',
    optionA: {
      image: '/quiz_images/우드톤 가구와 따뜻한 조명.jpg',
      label: '우드와 따뜻한 전구색 조명',
      score: 1 // Warm
    },
    optionB: {
      image: '/quiz_images/쿨톤.jpg',
      label: '정갈하고 이지적인 쿨톤 연출',
      score: -1 // Cool
    }
  },
  {
    id: 5,
    axis: 'tone',
    title: '휴식을 취할 소파의 색상과 질감은?',
    optionA: {
      image: '/quiz_images/베이지 브라운 패브릭 소파.jpg',
      label: '베이지 브라운의 따스한 느낌',
      score: 1 // Warm
    },
    optionB: {
      image: '/quiz_images/블루 그레이 패브릭 소파.jpg',
      label: '블루 그레이의 세련된 느낌',
      score: -1 // Cool
    }
  },
  {
    id: 6,
    axis: 'tone',
    title: '바닥을 장식할 러그를 고른다면?',
    optionA: {
      image: '/quiz_images/테라코타 머스타드 러그.jpg',
      label: '테라코타와 머스타드 등 대지의 온기',
      score: 1 // Warm
    },
    optionB: {
      image: '/quiz_images/차콜 아이스블루 러그.jpg',
      label: '차콜과 아이스블루의 모던함',
      score: -1 // Cool
    }
  },
  {
    id: 7,
    axis: 'era',
    title: '공간의 베이스가 될 내벽의 장식 디자인은?',
    optionA: {
      image: '/quiz_images/직선 라인의 미니멀 벽면.jpg',
      label: '간결한 직선 위주의 모던 마감',
      score: 1 // Modern
    },
    optionB: {
      image: '/quiz_images/몰딩과 앤틱 장식이 있는 벽.jpg',
      label: '클래식한 몰딩과 웨인스코팅 벽면',
      score: -1 // Classic
    }
  },
  {
    id: 8,
    axis: 'era',
    title: '당신의 시선을 더 끄는 가구 스타일은?',
    optionA: {
      image: '/quiz_images/블루 그레이 패브릭 소파.jpg',
      label: '직선과 면이 조화로운 현대식 소파',
      score: 1 // Modern
    },
    optionB: {
      image: '/quiz_images/우드 프레임의 클래식 가구.jpg',
      label: '장인정신이 깃든 앤틱 우드 가구',
      score: -1 // Classic
    }
  }
];

// 프롬프트 키워드 테이블 정의 (한국어로 필요한 것만 직관적으로 구성)
const KEYWORD_MAP = {
  space: {
    Minimal: '여백이 넉넉한 심플한 구성, 정돈된 가구 배치',
    Maximal: '화려하고 다채로운 소품, 개성 넘치는 레이어드 데코',
    Balanced: '균형 잡힌 레이아웃, 조화로운 소품 구성'
  },
  tone: {
    Warm: '따뜻한 간접 조명, 포근한 베이지/우드 톤 분위기',
    Cool: '정갈한 쿨톤, 모던한 그레이/블루 색채 조화',
    Balanced: '부드러운 뉴트럴 컬러, 화사한 자연 채광'
  },
  era: {
    Modern: '세련된 현대식 디자인, 간결한 직선 실루엣',
    Classic: '우아한 클래식 몰딩, 고풍스러운 원목 가구 조화',
    Mix: '자유로운 믹스앤매치 가이드, 현대적 배치'
  }
};

// 3개 축 성향에 따라 28가지 스타일 데이터베이스 내 최적의 매치 판별 규칙
const getBestStyleMatch = (space, tone, era) => {
  if (space === 'Minimal') {
    if (tone === 'Warm') {
      if (era === 'Modern') return '재팬디';
      if (era === 'Classic') return '내추럴';
      return '북유럽';
    } else if (tone === 'Cool') {
      if (era === 'Modern') return '미니멀';
      if (era === 'Classic') return '바우하우스';
      return '어반 모던';
    } else {
      return '젠 스타일';
    }
  } else if (space === 'Maximal') {
    if (tone === 'Warm') {
      if (era === 'Modern') return '레트로';
      if (era === 'Classic') return '빈티지';
      return '보헤미안';
    } else if (tone === 'Cool') {
      if (era === 'Modern') return '인더스트리얼';
      if (era === 'Classic') return '아트데코';
      return '에클레틱';
    } else {
      return '모로칸';
    }
  } else {
    if (tone === 'Warm') {
      if (era === 'Modern') return '컨템포러리';
      if (era === 'Classic') return '프렌치';
      return '프로방스';
    } else if (tone === 'Cool') {
      if (era === 'Modern') return '코스탈';
      if (era === 'Classic') return '미드센추리 모던';
      return '글램';
    } else {
      return '모던';
    }
  }
};

export default function StyleQuiz({ onApplyPrompt }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [scores, setScores] = useState({ space: 0, tone: 0, era: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultStyle, setResultStyle] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [resultTraits, setResultTraits] = useState([]); // 성향 저장용 상태 추가

  // 옵션 선택 시 점수 누적 및 다음 단계 이동
  const handleSelectOption = (axis, score) => {
    const nextScores = { ...scores, [axis]: scores[axis] + score };
    setScores(nextScores);

    if (currentStep < QUIZ_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // 퀴즈 완료 -> 진단 프로세스 가동
      setIsAnalyzing(true);
      setTimeout(() => {
        calculateResult(nextScores);
      }, 1500); // 1.5초 분석 애니메이션 대기
    }
  };

  const getStyleDescription = (name) => {
    const descMap = {
      '내추럴': '따뜻한 원목 가구와 자연 질감의 패브릭을 매치하여 도심 속에서도 숲속 같은 편안함과 자연의 생동감을 제공하는 힐링 스타일입니다.',
      '다크 모던': '깊이 있는 어두운 톤의 월넛 원목과 무채색 스틸 가구의 강렬한 대비를 통해 시크하고 묵직한 중후함을 살린 남성적이고 세련된 스타일입니다.',
      '미니멀': '불필요한 장식과 소품을 배제하고 간결한 직선 실루엣과 차분한 모노톤을 기본으로 설계하여, 시각적 피로를 덜어주는 극도의 정돈미를 제공합니다.',
      '북유럽': '화사한 자연 채광을 극대화하며, 부드러운 패브릭과 파스텔톤 컬러 포인트를 더해 실용적이면서도 따뜻한 북유럽의 코지함을 제공합니다.',
      '재팬디': '일본의 젠 스타일이 주는 고요한 정갈함과 북유럽의 따뜻함이 기분 좋게 어우러진 현대적인 베이지/우드 중심의 럭셔리 스타일입니다.'
    };
    return descMap[name] || '선택하신 취향의 조화로운 질감과 라이트 톤을 기반으로, 공간의 시각적 밸런스와 고급스러운 감성을 유감없이 발휘하는 맞춤형 공간 인테리어입니다.';
  };

  const getStyleMaterialTip = (name) => {
    const materialMap = {
      '내추럴': '실크 무지 벽지 (베이지/아이보리), 광폭 원목 마루, 린넨 패브릭 소파',
      '다크 모던': '다크 차콜 도장 벽면, 월넛 원목 가구, 블랙 가죽 시트, 스틸 프레임',
      '미니멀': '클린 화이트 무광 페인트, 포슬린 타일 바닥, 간결한 미니멀 소파',
      '북유럽': '라이트 그레이 실크벽지, 내추럴 리얼 오크 바닥, 쿨그레이 패브릭 소파',
      '재팬디': '샌드 베이지 친환경 도배지, 미디움 우드 텍스처 마루, 미니멀 라탄 조명'
    };
    return materialMap[name] || '화이트/뉴트럴 도배 벽면, 차분한 오크 톤 마루, 패브릭 가구 조화';
  };

  // 결과 연산 및 매핑
  const calculateResult = (finalScores) => {
    let spaceLabel = 'Balanced';
    if (finalScores.space > 0) spaceLabel = 'Minimal';
    else if (finalScores.space < 0) spaceLabel = 'Maximal';

    let toneLabel = 'Balanced';
    if (finalScores.tone > 0) toneLabel = 'Warm';
    else if (finalScores.tone < 0) toneLabel = 'Cool';

    let eraLabel = 'Mix';
    if (finalScores.era > 0) eraLabel = 'Modern';
    else if (finalScores.era < 0) eraLabel = 'Classic';

    const matchedName = getBestStyleMatch(spaceLabel, toneLabel, eraLabel);
    const dbStyle = STYLE_DATABASE.find(item => item.name === matchedName) || STYLE_DATABASE[0];

    const promptKeywords = [
      KEYWORD_MAP.space[spaceLabel],
      KEYWORD_MAP.tone[toneLabel],
      KEYWORD_MAP.era[eraLabel]
    ].join(', ');

    setResultStyle(dbStyle);
    setResultTraits([spaceLabel, toneLabel, eraLabel]);
    // [수정] 100% 깔끔한 한국어 핵심 프롬프트 키워드 조합으로 정돈
    setGeneratedPrompt(`${dbStyle.name} 스타일, ${promptKeywords}`);
    setIsAnalyzing(false);
    setShowResult(true);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setScores({ space: 0, tone: 0, era: 0 });
    setShowResult(false);
    setResultStyle(null);
    setGeneratedPrompt('');
    setCopied(false);
    setResultTraits([]);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. 로딩(분석) 중인 화면
  if (isAnalyzing) {
    return (
      <div className="quiz-container flex-center animate-fade-in" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
        <div className="quiz-card glassmorphism text-center p-xl flex-column flex-center gap-md" style={{ padding: '40px', borderRadius: '16px' }}>
          <div className="spinner-wrapper">
            <RefreshCw className="animate-spin text-accent" size={40} style={{ color: 'var(--primary)' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)', margin: '15px 0 8px 0' }}>공간 취향을 분석하고 있습니다...</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>선택하신 답변들을 바탕으로 나에게 딱 맞는 스타일을 매치하고 있습니다.</p>
        </div>
      </div>
    );
  }

  // 2. 결과 출력 화면
  if (showResult && resultStyle) {
    return (
      <div className="quiz-container" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
        <div className="quiz-result-card glassmorphism animate-fade-in" style={{ padding: '40px', borderRadius: '24px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', boxShadow: '0 20px 48px rgba(43,53,48,0.05)' }}>
          
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', background: 'rgba(197, 160, 89, 0.12)', padding: '6px 16px', borderRadius: '30px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Styling Match
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary)', marginTop: '16px', letterSpacing: '-0.5px' }}>
              🎉 {resultStyle.name} 스타일
            </h2>
            
            {/* 성향 배지 태그 리스트 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              {resultTraits.map((trait, idx) => (
                <span key={idx} style={{ fontSize: '0.72rem', fontWeight: '700', backgroundColor: '#F5EFEB', color: '#7A6C62', padding: '4px 12px', borderRadius: '30px' }}>
                  #{trait}
                </span>
              ))}
            </div>
          </div>

          <div className="quiz-result-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
            {/* 좌측: 고해상도 매핑 프리미엄 화보 이미지 */}
            <div className="quiz-result-image-box" style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 28px rgba(0,0,0,0.08)', position: 'relative', height: '320px' }}>
              <img 
                src={resultStyle.imageUrl} 
                alt={resultStyle.name} 
                className="quiz-result-img"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="quiz-result-img-overlay" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', padding: '20px', color: '#fff' }}>
                <span className="quiz-style-badge" style={{ backgroundColor: 'var(--primary)', padding: '6px 14px', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '800' }}>
                  {resultStyle.name} Gallery
                </span>
              </div>
            </div>

            {/* 우측: 감성 설명 및 프롬프트 연동 섹션 */}
            <div className="quiz-result-info flex-column" style={{ gap: '20px', height: '100%', justifyContent: 'space-between' }}>
              
              {/* 1) 맞춤 설명 가이드 카드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '20px', background: '#FCFAF7', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.88rem', fontWeight: '850', color: 'var(--primary)' }}>✍️ 나만의 스타일 특징</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.6', opacity: 0.9 }}>
                    {getStyleDescription(resultStyle.name)}
                  </p>
                </div>

                {/* 2) 추천 마감재 가이드 카드 */}
                <div style={{ padding: '20px', background: '#FCFAF7', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.88rem', fontWeight: '850', color: 'var(--primary)' }}>💡 추천 마감재 & 포인트 데코</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.6', opacity: 0.9 }}>
                    {getStyleMaterialTip(resultStyle.name)}
                  </p>
                </div>
              </div>

              {/* 영문 프롬프트 제공 박스 */}
              <div className="prompt-output-box" style={{ background: 'rgba(197, 160, 89, 0.03)', border: '1px dashed #CDBCB2', borderRadius: '16px', padding: '16px 20px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: '850', color: 'var(--primary)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Generated AI Remodeling Keywords
                </label>
                <div className="prompt-text-field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <span className="prompt-text-content" style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {generatedPrompt}
                  </span>
                  <button 
                    onClick={handleCopyPrompt} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '4px' }}
                    title="프롬프트 복사"
                  >
                    {copied ? <Check style={{ color: '#16a34a' }} size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* 하단 제어 액션들 */}
              <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                <button 
                  onClick={() => onApplyPrompt(generatedPrompt)} 
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '14px 20px', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.25s' }}
                >
                  이 스타일로 AI 리모델링 해보기 <ArrowRight size={16} />
                </button>
                <button 
                  onClick={handleRestart} 
                  className="btn btn-secondary"
                  style={{ padding: '14px 20px', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.25s' }}
                >
                  <RefreshCw size={16} /> 다시 하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 퀴즈 문항 진행 화면
  const currentQuestion = QUIZ_QUESTIONS[currentStep];
  const progressPercent = ((currentStep) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div className="quiz-container flex-center" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
      <div className="quiz-card glassmorphism p-xl flex-column gap-lg animate-fade-in" style={{ padding: '36px', borderRadius: '20px' }}>
        {/* 진행 헤더 */}
        <div className="quiz-header flex-column gap-xs" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
          <div className="flex-between text-xs opacity-7" style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
            <span style={{ color: 'var(--primary)' }}>스타일 취향 진단 퀴즈</span>
            <span>{currentStep + 1} / {QUIZ_QUESTIONS.length} 문항</span>
          </div>
          <div className="progress-bar-bg" style={{ height: '6px', borderRadius: '50px' }}>
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercent}%`, height: '100%', borderRadius: '50px', backgroundColor: 'var(--primary)' }}
            />
          </div>
        </div>

        {/* 질문 텍스트 */}
        <h2 className="quiz-title text-center text-glow py-sm" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: '16px 0', letterSpacing: '-0.3px', lineHeight: '1.4' }}>
          {currentQuestion.title}
        </h2>

        {/* A/B 이미지 선택지 */}
        <div className="quiz-options-layout" style={{ gap: '20px', fontFamily: 'Outfit, "Noto Sans KR", sans-serif' }}>
          {/* 옵션 A */}
          <div 
            onClick={() => handleSelectOption(currentQuestion.axis, currentQuestion.optionA.score)}
            className="quiz-option-card flex-column"
            style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', transition: 'all 0.25s', cursor: 'pointer' }}
          >
            <div className="quiz-option-image-wrapper" style={{ height: '170px' }}>
              <img 
                src={currentQuestion.optionA.image} 
                alt={currentQuestion.optionA.label} 
                className="quiz-option-img"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="option-badge select-a" style={{ backgroundColor: 'var(--primary)' }}>A</div>
            </div>
            <div className="quiz-option-label text-center" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', fontSize: '0.82rem', fontWeight: '700', padding: '12px 16px', color: 'var(--text-main)' }}>
              {currentQuestion.optionA.label}
            </div>
          </div>

          {/* 옵션 B */}
          <div 
            onClick={() => handleSelectOption(currentQuestion.axis, currentQuestion.optionB.score)}
            className="quiz-option-card flex-column"
            style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', transition: 'all 0.25s', cursor: 'pointer' }}
          >
            <div className="quiz-option-image-wrapper" style={{ height: '170px' }}>
              <img 
                src={currentQuestion.optionB.image} 
                alt={currentQuestion.optionB.label} 
                className="quiz-option-img"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="option-badge select-b" style={{ backgroundColor: '#B05B48' }}>B</div>
            </div>
            <div className="quiz-option-label text-center" style={{ fontFamily: 'Outfit, "Noto Sans KR", sans-serif', fontSize: '0.82rem', fontWeight: '700', padding: '12px 16px', color: 'var(--text-main)' }}>
              {currentQuestion.optionB.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
