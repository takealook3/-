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

// 프롬프트 키워드 테이블 정의
const KEYWORD_MAP = {
  space: {
    Minimal: 'minimalist, simple, clean lines, spacious, clutter-free',
    Maximal: 'maximalist, rich patterns, decorative details, cozy layering, active objects',
    Balanced: 'balanced space, tidy layout, structured design'
  },
  tone: {
    Warm: 'warm lighting, beige and cream tones, cozy atmosphere, wooden texture',
    Cool: 'cool tones, gray and blue color palette, sleek steel accents, modern clean lighting',
    Balanced: 'neutral color scheme, natural daylight, soft tones'
  },
  era: {
    Modern: 'modernist style, contemporary design, sleek lines',
    Classic: 'classic design, elegant antique furniture, wall moldings, vintage aesthetics',
    Mix: 'eclectic blend, transitional styling, timeless aesthetic'
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

  // 결과 연산 및 매핑
  const calculateResult = (finalScores) => {
    // 1. 축 성향 판별
    let spaceLabel = 'Balanced';
    if (finalScores.space > 0) spaceLabel = 'Minimal';
    else if (finalScores.space < 0) spaceLabel = 'Maximal';

    let toneLabel = 'Balanced';
    if (finalScores.tone > 0) toneLabel = 'Warm';
    else if (finalScores.tone < 0) toneLabel = 'Cool';

    let eraLabel = 'Mix';
    if (finalScores.era > 0) eraLabel = 'Modern';
    else if (finalScores.era < 0) eraLabel = 'Classic';

    // 2. 최종 스타일 매칭
    const matchedName = getBestStyleMatch(spaceLabel, toneLabel, eraLabel);
    const dbStyle = STYLE_DATABASE.find(item => item.name === matchedName) || STYLE_DATABASE[0];

    // 3. 프롬프트 문자열 생성
    const promptKeywords = [
      KEYWORD_MAP.space[spaceLabel],
      KEYWORD_MAP.tone[toneLabel],
      KEYWORD_MAP.era[eraLabel]
    ].join(', ');

    setResultStyle(dbStyle);
    setGeneratedPrompt(`high quality, 8k, photorealistic, ${dbStyle.name} interior style, ${promptKeywords}`);
    setIsAnalyzing(false);
    setShowResult(true);
  };

  // 초기화 및 다시 하기
  const handleRestart = () => {
    setCurrentStep(0);
    setScores({ space: 0, tone: 0, era: 0 });
    setShowResult(false);
    setResultStyle(null);
    setGeneratedPrompt('');
    setCopied(false);
  };

  // 프롬프트 복사 액션
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. 로딩(분석) 중인 화면
  if (isAnalyzing) {
    return (
      <div className="quiz-container flex-center animate-fade-in">
        <div className="quiz-card glassmorphism text-center p-xl flex-column flex-center gap-md">
          <div className="spinner-wrapper">
            <RefreshCw className="animate-spin text-accent" size={48} />
          </div>
          <h2 className="section-title text-glow">당신의 인테리어 취향 분석 중...</h2>
          <p className="subtitle">공간감, 색채 톤, 시대별 선호도를 결합하여 시그니처 28 스타일 도감과 대조하고 있습니다.</p>
        </div>
      </div>
    );
  }

  // 2. 결과 출력 화면
  if (showResult && resultStyle) {
    return (
      <div className="quiz-container">
        <div className="quiz-result-card glassmorphism p-xl flex-column gap-lg animate-fade-in">
          <div className="text-center">
            <span className="badge badge-accent">Quiz Result</span>
            <h2 className="section-title text-glow mt-sm">당신만을 위해 매칭된 시그니처 공간 스타일</h2>
          </div>

          <div className="quiz-result-layout">
            {/* 좌측: 고해상도 매핑 프리미엄 화보 이미지 */}
            <div className="quiz-result-image-box">
              <img 
                src={resultStyle.imageUrl} 
                alt={resultStyle.name} 
                className="quiz-result-img"
              />
              <div className="quiz-result-img-overlay">
                <span className="quiz-style-badge">{resultStyle.name} 스타일</span>
              </div>
            </div>

            {/* 우측: 감성 설명 및 프롬프트 연동 섹션 */}
            <div className="quiz-result-info flex-column gap-md">
              <div className="style-description-box p-md bg-glass-dark" style={{ padding: '16px' }}>
                <div className="style-tips-list">
                  <strong className="text-accent text-sm" style={{ fontWeight: 'bold' }}>💡 공간 스타일링 연출 팁: </strong>
                  <span className="text-sm ml-xs" style={{ color: 'var(--text-main)', opacity: 0.9 }}>
                    선택하신 질감과 톤이 가장 돋보일 수 있는 베이직 가구를 중심으로 공간의 분위기를 극대화해 보세요.
                  </span>
                </div>
              </div>

              {/* 영문 프롬프트 제공 박스 */}
              <div className="prompt-output-box">
                <label className="text-xs text-accent font-bold uppercase tracking-wider block mb-xs">생성된 AI 프롬프트 키워드</label>
                <div className="prompt-text-field flex-center">
                  <span className="prompt-text-content">{generatedPrompt}</span>
                  <button 
                    onClick={handleCopyPrompt} 
                    className="btn-icon" 
                    title="프롬프트 복사"
                  >
                    {copied ? <Check className="text-success" size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {/* 하단 제어 액션들 */}
              <div className="result-buttons flex-row gap-sm mt-sm">
                <button 
                  onClick={() => onApplyPrompt(generatedPrompt)} 
                  className="btn btn-primary flex-center gap-sm flex-1"
                >
                  이 스타일로 AI 리모델링 해보기 <ArrowRight size={18} />
                </button>
                <button 
                  onClick={handleRestart} 
                  className="btn btn-secondary flex-center gap-xs"
                >
                  <RefreshCw size={18} /> 다시 하기
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
    <div className="quiz-container flex-center">
      <div className="quiz-card glassmorphism p-xl flex-column gap-lg animate-fade-in">
        {/* 진행 헤더 */}
        <div className="quiz-header flex-column gap-xs">
          <div className="flex-between text-xs opacity-7 font-bold">
            <span className="text-accent uppercase tracking-widest">Onboarding Quiz</span>
            <span>{currentStep + 1} / {QUIZ_QUESTIONS.length} 문항</span>
          </div>
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 질문 텍스트 */}
        <h2 className="quiz-title text-center text-glow py-sm">
          {currentQuestion.title}
        </h2>

        {/* A/B 이미지 선택지 */}
        <div className="quiz-options-layout">
          {/* 옵션 A */}
          <div 
            onClick={() => handleSelectOption(currentQuestion.axis, currentQuestion.optionA.score)}
            className="quiz-option-card flex-column"
          >
            <div className="quiz-option-image-wrapper">
              <img 
                src={currentQuestion.optionA.image} 
                alt={currentQuestion.optionA.label} 
                className="quiz-option-img"
              />
              <div className="option-badge select-a">A</div>
            </div>
            <div className="quiz-option-label text-center">
              {currentQuestion.optionA.label}
            </div>
          </div>

          {/* 옵션 B */}
          <div 
            onClick={() => handleSelectOption(currentQuestion.axis, currentQuestion.optionB.score)}
            className="quiz-option-card flex-column"
          >
            <div className="quiz-option-image-wrapper">
              <img 
                src={currentQuestion.optionB.image} 
                alt={currentQuestion.optionB.label} 
                className="quiz-option-img"
              />
              <div className="option-badge select-b">B</div>
            </div>
            <div className="quiz-option-label text-center">
              {currentQuestion.optionB.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
