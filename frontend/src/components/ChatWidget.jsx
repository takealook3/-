// =====================================================================
// [ChatWidget.jsx: AI 인테리어 취향 & 추구미 상담소 메신저 컴포넌트]
// 비유: 내 방의 분위기와 취향을 찰떡같이 파악하고 맞춤 컬러와 가구 스타일링을
// 조언해 주는 1:1 전담 인테리어 스타일리스트 카카오톡 채팅창입니다!
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';

const QUICK_QUESTIONS = [
  "✨ 화사하고 밝은 미니멀 거실에 어울리는 소파 컬러는?",
  "🌿 따뜻한 내추럴 우드 침실을 위한 아늑한 스타일링 팁",
  "🛋️ 북유럽 스타일 공간에 어울리는 조명과 러그 조합 추천",
  "🕶️ 차분하고 도시적인 모던 서재 공간 꾸미는 가이드"
];

export default function ChatWidget({ sessionId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "안녕하세요! 🎨 나만의 인테리어 취향(추구미), 공간별 컬러 조합, 가구 스타일링 팁에 대해 무엇이든 편하게 물어보세요. AI 인테리어 스타일리스트가 맞춤 조언을 드립니다!",
      references: ["ZipPT 5대 인테리어 취향 데이터베이스", "공간 감성 컬러 매칭 가이드"]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 채팅이 추가될 때마다 자동으로 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (questionText) => {
    const q = questionText || input;
    if (!q || !q.trim() || loading) return;

    const userMsg = { sender: 'user', text: q.trim() };
    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);

    const res = await sendChatMessage({
      sessionId: sessionId || "session_default",
      question: q.trim()
    });

    setLoading(false);

    if (res.success) {
      const respData = res.data || {};
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: respData.answer || res.message || "답변이 도착했습니다.",
          references: respData.references || []
        }
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ 죄송합니다. AI 취향 상담 연결 중 오류가 발생했습니다: ${res.message}`,
          isError: true
        }
      ]);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* 1. 플로팅 아이콘 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '14px 24px',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span style={{ fontSize: '1.3rem' }}>💬</span>
          <span>AI 인테리어 취향 상담</span>
        </button>
      )}

      {/* 2. 메신저 대화창 패널 */}
      {isOpen && (
        <div style={{
          width: '380px',
          height: '560px',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* 상단 헤더 바 */}
          <div style={{
            background: 'linear-gradient(135deg, #312e81, #4c1d95)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #4338ca'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>🎨</span>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ffffff' }}>AI 취향 & 추구미 스타일리스트</div>
                <div style={{ fontSize: '0.75rem', color: '#c7d2fe' }}>나만의 인테리어 취향 맞춤 상담</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="닫기"
            >
              ✕
            </button>
          </div>

          {/* 대화 목록 영역 */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: '#0f172a'
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  backgroundColor: msg.sender === 'user' ? '#4f46e5' : '#334155',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  lineHeight: '1.45',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}>
                  {msg.text}
                </div>

                {/* 참고 출처 / 취향 데이터 태그 표시 제거됨 */}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', paddingLeft: '8px' }}>
                <span>✨ AI 스타일리스트가 취향 데이터를 분석하여 답변 작성 중...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 추천 질문 칩 (Quick Chips) 영역 */}
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#1e293b',
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {QUICK_QUESTIONS.map((qText, qIdx) => (
              <button
                key={qIdx}
                onClick={() => handleSend(qText)}
                disabled={loading}
                style={{
                  background: '#334155',
                  border: '1px solid #475569',
                  color: '#e2e8f0',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#475569'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#334155'; }}
              >
                {qText}
              </button>
            ))}
          </div>

          {/* 하단 입력 영역 */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: '12px',
              backgroundColor: '#0f172a',
              borderTop: '1px solid #334155',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="취향이나 스타일링 팁을 물어보세요..."
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'white',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: loading || !input.trim() ? '#475569' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                fontWeight: '700',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
