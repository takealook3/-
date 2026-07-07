// =====================================================================
// [StyleRecommendationSection.jsx: 스타일 기반 자재 및 가구 매칭 추천 섹션]
// =====================================================================
import React, { useState, useEffect } from 'react';
import { recommendStyles } from '../services/api';

export default function StyleRecommendationSection({ prompt, visible }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || !prompt) {
      setRecommendations([]);
      return;
    }

    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await recommendStyles(prompt);
        if (response.success && response.data && response.data.recommendations) {
          setRecommendations(response.data.recommendations);
        } else {
          setError(response.message || "스타일 추천 데이터를 불러오지 못했습니다.");
        }
      } catch (err) {
        setError("서버 통신 실패: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [visible, prompt]);

  if (!visible) return null;

  return (
    <div style={{ 
      marginTop: '32px', 
      paddingTop: '24px', 
      borderTop: '1px solid var(--border-color)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      <h3 style={{ 
        fontSize: '1.15rem', 
        fontWeight: '800', 
        color: 'var(--primary)', 
        marginBottom: '4px',
        textAlign: 'left',
        letterSpacing: '-0.02em'
      }}>
        ✨ 스타일 매칭 맞춤 추천 제안 (벽지, 바닥재, 가구)
      </h3>
      <p style={{ 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)', 
        marginBottom: '20px',
        textAlign: 'left'
      }}>
        변환하신 분위기("{prompt}")에 어울리도록 엄선한 데이터베이스 연계 자재 및 가구 매칭 리스트입니다.
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', animation: 'pulse 1.2s infinite' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>스타일에 어울리는 가구와 벽지, 바닥재를 수색 중...</span>
        </div>
      ) : error ? (
        <div style={{ fontSize: '0.85rem', color: '#EF4444', background: '#FEF2F2', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      ) : recommendations.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          일치하는 추천 스타일 데이터가 없습니다.
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px',
          width: '100%'
        }}>
          {recommendations.map((item, index) => (
            <div 
              key={`style-${index}`}
              style={{
                background: 'rgba(255, 255, 255, 0.55)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.02)';
              }}
            >
              {/* 스타일 헤더 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent)', textAlign: 'left' }}>
                  {item.style_name} 스타일 제안
                </div>
                {item.features && item.features.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {item.features.map((feat, fIdx) => (
                      <span 
                        key={fIdx}
                        style={{
                          fontSize: '0.65rem',
                          background: '#E2E8F0',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '500'
                        }}
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 자재 리스트 (벽지 & 바닥재) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. 벽지 카드 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img 
                    src={item.wallpaper_image_url} 
                    alt={item.wallpaper_name} 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      objectFit: 'cover', 
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      flexShrink: 0
                    }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>추천 벽지</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.wallpaper_name}</span>
                  </div>
                </div>

                {/* 2. 바닥재 카드 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img 
                    src={item.floor_image_url} 
                    alt={item.floor_name} 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      objectFit: 'cover', 
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      flexShrink: 0
                    }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>추천 바닥재</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.floor_name}</span>
                  </div>
                </div>
              </div>

              {/* 매칭 스타일 추천 가구 앨범 */}
              {(item.sofa_image_url || item.bed_image_url || item.objet_image_url) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase' }}>어울리는 매칭 가구 데코</span>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {item.sofa_image_url && (
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <img 
                          src={item.sofa_image_url} 
                          alt="추천 소파" 
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>소파</div>
                      </div>
                    )}
                    {item.bed_image_url && (
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <img 
                          src={item.bed_image_url} 
                          alt="추천 침대" 
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>침대</div>
                      </div>
                    )}
                    {item.objet_image_url && (
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <img 
                          src={item.objet_image_url} 
                          alt="추천 오브제" 
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>오브제</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
