// ============================================================================
// AI 얼굴 유사도 분석 프론트엔드 제어 스크립트 (face.js)
// 비유하자면, 두 의뢰인의 사진을 양손에 들고 AI 감정소 창구에 접수한 뒤,
// 판정 결과가 나오면 전광판의 일치율 게이지를 신나게 올려주는 '접수 안내원' 역할입니다.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 화면 요소 연결
    const fileInput1 = document.getElementById('file-input-1');
    const fileInput2 = document.getElementById('file-input-2');
    const previewBox1 = document.getElementById('preview-box-1');
    const previewBox2 = document.getElementById('preview-box-2');
    const img1 = document.getElementById('img-1');
    const img2 = document.getElementById('img-2');
    const placeholder1 = document.getElementById('placeholder-1');
    const placeholder2 = document.getElementById('placeholder-2');
    const compareBtn = document.getElementById('compare-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // 결과 영역 요소
    const resultSection = document.getElementById('result-section');
    const verdictText = document.getElementById('verdict-text');
    const simPercentage = document.getElementById('sim-percentage');
    const gaugeFill = document.getElementById('gauge-fill');
    const yoloInfo = document.getElementById('yolo-info');
    const faceInfo = document.getElementById('face-info');

    let file1Data = null;
    let file2Data = null;

    // 2. 파일 선택 이벤트 처리 (1번 인물)
    fileInput1.addEventListener('change', () => {
        if (fileInput1.files.length > 0) {
            file1Data = fileInput1.files[0];
            showPreview(file1Data, img1, previewBox1, placeholder1);
            checkReady();
        }
    });

    // 파일 선택 이벤트 처리 (2번 인물)
    fileInput2.addEventListener('change', () => {
        if (fileInput2.files.length > 0) {
            file2Data = fileInput2.files[0];
            showPreview(file2Data, img2, previewBox2, placeholder2);
            checkReady();
        }
    });

    // 사진 미리보기 표시 함수
    function showPreview(file, imgElem, boxElem, placeholderElem) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imgElem.src = e.target.result;
            boxElem.classList.remove('hidden');
            placeholderElem.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    // 3. 두 사진이 모두 등록되었는지 확인하여 버튼 활성화
    function checkReady() {
        if (file1Data && file2Data) {
            compareBtn.disabled = false;
        } else {
            compareBtn.disabled = true;
        }
    }

    // 4. [분석하기] 버튼 클릭 시 백엔드 API 요청
    compareBtn.addEventListener('click', () => {
        if (!file1Data || !file2Data) return;

        // UI 상태 변경 (로딩 중)
        compareBtn.disabled = true;
        loadingSpinner.classList.remove('hidden');
        resultSection.classList.add('hidden');
        gaugeFill.style.width = '0%'; // 게이지 바 초기화

        const formData = new FormData();
        formData.append('file1', file1Data);
        formData.append('file2', file2Data);

        fetch('/analyze_face_similarity', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.detail || '분석 중 오류가 발생했습니다.'); });
            }
            return response.json();
        })
        .then(data => {
            loadingSpinner.classList.add('hidden');
            compareBtn.disabled = false;

            if (data.status === 'fail') {
                alert(data.message);
                return;
            }

            // 분석 결과 렌더링
            renderResults(data);
        })
        .catch(error => {
            loadingSpinner.classList.add('hidden');
            compareBtn.disabled = false;
            alert('❌ ' + error.message);
        });
    });

    // 5. 서버 분석 결과 렌더링 및 애니메이션 실행 함수
    function renderResults(data) {
        verdictText.textContent = data.verdict;
        
        // 동일 인물 여부에 따라 텍스트 색상 변경
        if (data.is_same_person) {
            verdictText.style.color = '#00DF89'; // 민트색 (성공)
        } else {
            verdictText.style.color = '#FF0080'; // 핑크색 (불일치)
        }

        yoloInfo.textContent = `1번 ${data.yolo_objects_detected[0]}개 / 2번 ${data.yolo_objects_detected[1]}개`;
        faceInfo.textContent = `1번 ${data.faces_count[0]}개 / 2번 ${data.faces_count[1]}개`;

        resultSection.classList.remove('hidden');

        // 부드럽게 숫자가 올라가며 게이지 바가 차오르는 애니메이션
        setTimeout(() => {
            gaugeFill.style.width = data.similarity_percentage;
            animateValue(simPercentage, 0, parseFloat(data.similarity_percentage), 1200);
        }, 100);
    }

    // 숫자 카운트업 애니메이션 함수
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const currentVal = (progress * (end - start) + start).toFixed(2);
            obj.textContent = `${currentVal}%`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
