// ============================================================================
// AI 올인원 종합 비전 스튜디오 제어 스크립트 (studio.js)
// 비유하자면, 종합 건강검진센터의 '총괄 안내원'으로서 의뢰인의 사진을 접수받아
// 4곳의 진료과(분류, 탐지, 자세, 관상)에 동시에 전달하고 종합 보고서를 작성합니다.
// ============================================================================

// 1. 상단 탭 전환 함수 (새로고침 없이 화면 변경)
window.switchTab = function(tabId) {
    // 모든 탭 버튼과 패널의 활성화 상태 제거
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    // 클릭된 탭 버튼 및 패널 활성화
    const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (clickedBtn) clickedBtn.classList.add('active');
    
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');
};

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 모드 1: 🌟 올인원 동시 검진 (분류 + 탐지 + 자세 3개 API 동시 호출)
    // =========================================================================
    const allFileInput = document.getElementById('all-file-input');
    const allLoading = document.getElementById('all-loading');
    const allResults = document.getElementById('all-results');
    const allResetBox = document.getElementById('all-reset-box');

    if (allFileInput) {
        allFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) runAllInOne(e.target.files[0]);
        });
    }

    function runAllInOne(file) {
        if (!file.type.startsWith('image/')) {
            alert('❌ 이미지 파일만 올려주세요!');
            return;
        }

        // 로딩 화면 표시
        allFileInput.parentElement.classList.add('hidden');
        allLoading.classList.remove('hidden');
        allResults.classList.add('hidden');
        allResetBox.classList.add('hidden');

        // 3개 API로 동시에 보낼 데이터 구성
        const formData1 = new FormData(); formData1.append('file', file);
        const formData2 = new FormData(); formData2.append('file', file);
        const formData3 = new FormData(); formData3.append('file', file);

        // Promise.all로 3개 AI 감별사에게 동시 분석 의뢰
        Promise.all([
            fetch('/predict', { method: 'POST', body: formData1 }).then(r => r.json()),
            fetch('/detect', { method: 'POST', body: formData2 }).then(r => r.json()),
            fetch('/pose', { method: 'POST', body: formData3 }).then(r => r.json())
        ])
        .then(([clsData, detData, poseData]) => {
            allLoading.classList.add('hidden');
            allResults.classList.remove('hidden');
            allResetBox.classList.remove('hidden');

            // 1) 이미지 분류 렌더링
            const clsList = document.getElementById('all-cls-list');
            const clsImg = document.getElementById('all-cls-img');
            const reader = new FileReader();
            reader.onload = (e) => { clsImg.src = e.target.result; };
            reader.readAsDataURL(file);

            clsList.innerHTML = '';
            if (clsData.predictions) {
                clsData.predictions.forEach(item => {
                    clsList.innerHTML += `
                        <div style="margin-top: 0.6rem; font-size: 0.9rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong style="color: #fff;">${item.rank}위: ${item.category}</strong>
                                <span style="color: #FF0080; font-weight: 700;">${item.probability}</span>
                            </div>
                            <div class="rank-bar-bg"><div class="rank-bar-fill" style="width: ${item.probability};"></div></div>
                        </div>
                    `;
                });
            }

            // 2) 객체 탐지 렌더링
            const detImg = document.getElementById('all-det-img');
            const detInfo = document.getElementById('all-det-info');
            if (detData.detect_image_base64) detImg.src = detData.detect_image_base64;
            detInfo.innerHTML = `✨ 총 <strong>${detData.total_detected || 0}개</strong>의 물체가 탐지되었습니다.`;

            // 3) 포즈 추정 렌더링
            const poseImg = document.getElementById('all-pose-img');
            const poseInfo = document.getElementById('all-pose-info');
            if (poseData.pose_image_base64) poseImg.src = poseData.pose_image_base64;
            poseInfo.innerHTML = `✨ 총 <strong>${poseData.total_persons_detected || 0}명</strong>의 관절 뼈대가 스캔되었습니다.`;
        })
        .catch(err => {
            allLoading.classList.add('hidden');
            allFileInput.parentElement.classList.remove('hidden');
            alert('❌ 동시 분석 중 오류가 발생했습니다: ' + err.message);
        });
    }

    window.resetAllTab = function() {
        allResults.classList.add('hidden');
        allResetBox.classList.add('hidden');
        allFileInput.parentElement.classList.remove('hidden');
        allFileInput.value = '';
    };

    // =========================================================================
    // 모드 2~4: 단독 모드 파일 핸들러 (분류, 탐지, 자세)
    // =========================================================================
    setupSingleMode('cls', '/predict', (data, preview) => {
        const list = document.getElementById('cls-list');
        list.innerHTML = '<h3>🏆 상위 5개 판독 결과</h3>';
        data.predictions.forEach(item => {
            list.innerHTML += `<p style="margin: 0.5rem 0; font-size: 1.1rem;"><strong>${item.rank}위. ${item.category}</strong> (${item.probability})</p>`;
        });
    });

    setupSingleMode('det', '/detect', (data, preview) => {
        if (data.detect_image_base64) preview.src = data.detect_image_base64;
        document.getElementById('det-info').innerHTML = `<h3 style="color:#00DF89;">✨ ${data.total_detected}개 물체 탐지 완료</h3>`;
    });

    setupSingleMode('pose', '/pose', (data, preview) => {
        if (data.pose_image_base64) preview.src = data.pose_image_base64;
        document.getElementById('pose-info').innerHTML = `<h3 style="color:#00F0FF;">✨ ${data.total_persons_detected}명 뼈대 스캔 완료</h3>`;
    });

    function setupSingleMode(prefix, endpoint, renderCallback) {
        const input = document.getElementById(`${prefix}-file-input`);
        const loading = document.getElementById(`${prefix}-loading`);
        const result = document.getElementById(`${prefix}-result`);
        const preview = document.getElementById(`${prefix}-preview`);

        if (!input) return;
        input.addEventListener('change', (e) => {
            if (e.target.files.length === 0) return;
            const file = e.target.files[0];
            input.parentElement.classList.add('hidden');
            loading.classList.remove('hidden');
            result.classList.add('hidden');

            const reader = new FileReader();
            reader.onload = (evt) => { preview.src = evt.target.result; };
            reader.readAsDataURL(file);

            const formData = new FormData(); formData.append('file', file);
            fetch(endpoint, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                loading.classList.add('hidden');
                result.classList.remove('hidden');
                renderCallback(data, preview);
            })
            .catch(err => {
                loading.classList.add('hidden');
                input.parentElement.classList.remove('hidden');
                alert('❌ 분석 중 오류: ' + err.message);
            });
        });
    }

    // =========================================================================
    // 모드 5: 👥 얼굴 유사도 단독 모드 핸들러
    // =========================================================================
    let file1 = null, file2 = null;
    const faceInput1 = document.getElementById('face-input-1');
    const faceInput2 = document.getElementById('face-input-2');
    const faceBtn = document.getElementById('face-btn');

    if (faceInput1) {
        faceInput1.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                file1 = e.target.files[0];
                showFaceThumb(file1, 'face-img-1', 'face-txt-1');
                checkFaceReady();
            }
        });
    }
    if (faceInput2) {
        faceInput2.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                file2 = e.target.files[0];
                showFaceThumb(file2, 'face-img-2', 'face-txt-2');
                checkFaceReady();
            }
        });
    }

    function showFaceThumb(file, imgId, txtId) {
        const img = document.getElementById(imgId);
        const txt = document.getElementById(txtId);
        const reader = new FileReader();
        reader.onload = (evt) => {
            img.src = evt.target.result;
            img.style.display = 'block';
            txt.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function checkFaceReady() {
        if (file1 && file2) faceBtn.disabled = false;
    }

    if (faceBtn) {
        faceBtn.addEventListener('click', () => {
            if (!file1 || !file2) return;
            faceBtn.disabled = true;
            document.getElementById('face-loading').classList.remove('hidden');
            document.getElementById('face-result').classList.add('hidden');

            const formData = new FormData();
            formData.append('file1', file1);
            formData.append('file2', file2);

            fetch('/analyze_face_similarity', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                document.getElementById('face-loading').classList.add('hidden');
                faceBtn.disabled = false;
                if (data.status === 'fail') { alert(data.message); return; }

                document.getElementById('face-verdict').textContent = data.verdict;
                document.getElementById('face-sim-score').textContent = data.similarity_percentage;
                document.getElementById('face-result').classList.remove('hidden');
            })
            .catch(err => {
                document.getElementById('face-loading').classList.add('hidden');
                faceBtn.disabled = false;
                alert('❌ 얼굴 비교 오류: ' + err.message);
            });
        });
    }
});
