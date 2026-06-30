// ============================================================================
// 스마트 다중 API 조건부 시각화 제어 스크립트 (demo_multi.js)
// 비유하자면, 검진 센터의 '스마트 AI 매니저'로서 사진 속 환자(사람) 수에 따라
// 꼭 필요한 전문 진료실(분류, 탐지, 자세, 얼굴)의 불을 차례대로 켜주는 역할입니다.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('multi-file-input');
    const loadingSection = document.getElementById('multi-loading');
    const loadingText = document.getElementById('loading-text');
    const statusBanner = document.getElementById('status-banner');
    const resultsGrid = document.getElementById('results-grid');
    const resetBox = document.getElementById('reset-box');

    // 카드 요소들
    const cardPose = document.getElementById('card-pose');
    const cardFace = document.getElementById('card-face');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                runSmartPipeline(e.target.files[0]);
            }
        });
    }

    function runSmartPipeline(file) {
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일만 올려주세요!');
            return;
        }

        // 1. UI 초기화 및 로딩 표시
        fileInput.parentElement.classList.add('hidden');
        statusBanner.classList.add('hidden');
        resultsGrid.classList.add('hidden');
        resetBox.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        loadingText.innerHTML = '🤖 스마트 파이프라인 가동: 사진 속 인물 유무 및 수를 판단하는 중...';

        // 2. 서버의 스마트 파이프라인 창구(/api/multi_demo)로 전송
        const formData = new FormData();
        formData.append('file', file);

        // 원본 사진 미리보기 로드
        const reader = new FileReader();
        let originalDataUrl = '';
        reader.onload = (evt) => { originalDataUrl = evt.target.result; };
        reader.readAsDataURL(file);

        fetch('/api/multi_demo', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) throw new Error('파이프라인 분석 중 서버 오류가 발생했습니다.');
            return response.json();
        })
        .then(data => {
            // 최신 분석 데이터를 전역 변수에 보관합니다 (비유: 현상된 사진을 봉투에 임시 보관)
            window.lastPipelineData = data;

            loadingSection.classList.add('hidden');
            statusBanner.classList.remove('hidden');
            resultsGrid.classList.remove('hidden');
            resetBox.classList.remove('hidden');

            // 배너 메시지 렌더링
            statusBanner.innerHTML = data.message;

            // -------------------------------------------------------------
            // [카드 1] 이미지 분류 렌더링 (항상 표시)
            // -------------------------------------------------------------
            document.getElementById('preview-cls').src = originalDataUrl;
            const contentCls = document.getElementById('content-cls');
            contentCls.innerHTML = '';
            data.classification.forEach(item => {
                contentCls.innerHTML += `
                    <div style="margin-top: 0.6rem; font-size: 0.95rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong style="color: #fff;">${item.rank}위: ${item.category}</strong>
                            <span style="color: #FF0080; font-weight: 700;">${item.probability}</span>
                        </div>
                        <div class="rank-bar-bg"><div class="rank-bar-fill" style="width: ${item.probability};"></div></div>
                    </div>
                `;
            });

            // -------------------------------------------------------------
            // [카드 2] 객체 탐지 렌더링 (항상 표시)
            // -------------------------------------------------------------
            document.getElementById('preview-det').src = data.detection.image_base64;
            document.getElementById('content-det').innerHTML = `
                <p style="font-size: 1.05rem; margin-top: 0.5rem;">✨ 탐지된 전체 물체 수: <strong style="color:#00DF89;">${data.detection.total_detected}개</strong></p>
                <p style="font-size: 0.95rem; color: #ccc;">👤 그 중 감지된 사람 수: <strong style="color:#00F0FF;">${data.person_count}명</strong></p>
            `;

            // -------------------------------------------------------------
            // [카드 3 & 4] 사람 수에 따른 조건부 시각화 제어
            // -------------------------------------------------------------
            if (data.step === 'no_person') {
                // 사람이 없으면 자세 인식과 얼굴 인식 카드 숨김
                cardPose.classList.add('hidden');
                cardFace.classList.add('hidden');
            } 
            else if (data.step === 'single_person' || data.step === 'multi_person_no_faces') {
                // 사람이 1명 있거나 얼굴이 선명하지 않으면 자세 인식 카드만 표시
                cardPose.classList.remove('hidden');
                cardFace.classList.add('hidden');

                document.getElementById('preview-pose').src = data.pose.image_base64;
                document.getElementById('content-pose').innerHTML = `
                    <p style="font-size: 1.05rem; margin-top: 0.5rem;">✨ 스캔된 뼈대 관절 수: <strong style="color:#00F0FF;">${data.pose.total_persons_detected}명</strong></p>
                    <p style="font-size: 0.9rem; color: #aaa;">💡 머리, 어깨, 팔꿈치, 무릎 등 17개 핵심 관절 위치 시각화 완료</p>
                `;
            } 
            else if (data.step === 'multi_person_with_faces') {
                // 사람이 2명 이상이고 얼굴도 감지되면 4개 카드 모두 표시!
                cardPose.classList.remove('hidden');
                cardFace.classList.remove('hidden');

                // 자세 인식 카드 세팅
                document.getElementById('preview-pose').src = data.pose.image_base64;
                document.getElementById('content-pose').innerHTML = `
                    <p style="font-size: 1.05rem; margin-top: 0.5rem;">✨ 스캔된 뼈대 관절 수: <strong style="color:#00F0FF;">${data.pose.total_persons_detected}명</strong></p>
                `;

                // 얼굴 유사도 카드 세팅
                document.getElementById('preview-face').src = data.face_similarity.image_base64;
                document.getElementById('content-face').innerHTML = `
                    <div style="background: rgba(255,170,0,0.1); padding: 1rem; border-radius: 12px; margin-top: 0.5rem; border: 1px solid rgba(255,170,0,0.3);">
                        <p style="font-size: 0.95rem; color: #FFAA00; font-weight: 700;">📸 감지된 얼굴: ${data.face_similarity.faces_count}개</p>
                        <p style="font-size: 1.3rem; font-weight: 800; color: #fff; margin: 0.5rem 0;">닮은꼴 일치율: <span style="color: #00DF89;">${data.face_similarity.similarity_percentage}</span></p>
                        <p style="font-size: 0.95rem; color: #ddd;">${data.face_similarity.verdict}</p>
                    </div>
                `;
            }
        })
        .catch(err => {
            loadingSection.classList.add('hidden');
            fileInput.parentElement.classList.remove('hidden');
            alert('❌ 오류 발생: ' + err.message);
        });
    }

    // 초기화 버튼 함수
    window.resetPipeline = function() {
        resultsGrid.classList.add('hidden');
        statusBanner.classList.add('hidden');
        resetBox.classList.add('hidden');
        fileInput.parentElement.classList.remove('hidden');
        fileInput.value = '';
    };

    // 시각화 결과 이미지 다운로드 함수 (비유: 사진관에서 현상된 사진들을 손님에게 봉투에 담아 전달하는 역할)
    window.downloadResults = function() {
        if (!window.lastPipelineData) {
            alert('❌ 다운로드할 분석 결과 데이터가 없습니다.');
            return;
        }
        const data = window.lastPipelineData;
        
        function downloadImage(dataUrl, filename) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        alert('📥 AI 분석 시각화 결과 이미지 다운로드를 시작합니다!');
        if (data.detection && data.detection.image_base64) {
            downloadImage(data.detection.image_base64, '1_object_detection.jpg');
        }
        if (data.pose && data.pose.image_base64) {
            setTimeout(() => downloadImage(data.pose.image_base64, '2_pose_estimation.jpg'), 500);
        }
        if (data.face_similarity && data.face_similarity.image_base64) {
            setTimeout(() => downloadImage(data.face_similarity.image_base64, '3_face_similarity.jpg'), 1000);
        }
    };
});
