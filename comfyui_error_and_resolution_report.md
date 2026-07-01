# ComfyUI 인테리어 이미지 생성 파이프라인 에러 및 조치 보고서 (Resolution Report)

본 보고서는 사용자의 Blackwell RTX 5060 Laptop GPU 환경에서 ComfyUI를 이용한 가구 스타일 인페인팅 및 방 전체 리모델링 워크플로우를 구축하는 과정에서 직면했던 기술적 문제들과 오류 해결 방안을 상세히 기록한 문서입니다.

---

## 1. 하드웨어 및 컴파일 바이너리 호환 오류

### 1-1. Blackwell sm_120 CUDA Kernel 이미지 누락 오류
* **오류 메시지**: `RuntimeError: CUDA error: no kernel image is available for execution on the device`
* **원인**: 
  * 기존 가상환경(`venv`)에 설치되어 있던 PyTorch `2.6.0+cu124` 패키지는 CUDA 12.4 버전을 타겟으로 빌드되어, 사용자의 최신 Blackwell 아키텍처 GPU(RTX 5060, 연산 능력 `sm_120`)용 컴파일 바이너리 커널이 내장되어 있지 않아 CLIPTextEncode 연산 진입 시 즉시 중단 및 런타임 에러를 발생시켰습니다.
* **해결 방법**:
  * CUDA 12.8 및 Blackwell sm_120 연산 기능을 공식 지원하는 최신 PyTorch 패키지로 강제 교체 설치하여 드라이버 및 연산 적합성을 확보했습니다.
  * **수행 명령어**:
    ```bash
    .\venv\Scripts\pip.exe install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
    ```

---

## 2. 워크플로우 노드 및 링크 설계 오류

### 2-1. `SEGSDetailer` 의 `control_net` 포트 미지원 오류
* **오류 메시지**: `TypeError: SEGSDetailer.doit() got an unexpected keyword argument 'control_net'`
* **원인**:
  * `SEGSDetailer` 노드는 자체 파이썬 정의상 `control_net` 매개변수나 관련 입력 핀을 지원하지 않습니다. 이전 JSON 파일 내에 ControlNet Loader가 디테일러 노드로 잘못 직결되어 언패킹 에러를 일으켰습니다.
* **해결 방법**:
  * Impact Pack 전용 ControlNet 처리 노드인 **`ImpactControlNetApplySEGS`** 노드를 신설 연동했습니다. 감지된 가구 마스크 정보(`SEGS`) 내부에 ControlNet 가중치를 래핑한 뒤 디테일러로 넘기는 구조로 변경하여 오류를 해결했습니다.

### 2-2. 노드 클래스 타입 맵핑명 불일치 오류 (`no class_type`)
* **오류 메시지**: `Node 'ID #13' (혹은 #14) has no class_type. The workflow may be corrupted...`
* **원인**:
  * JSON 내 노드 정의 시 type 항목에 파이썬 클래스명(`ControlNetApplySEGS`, `SEGSLabelFilter`)을 그대로 사용했으나, 실제 ComfyUI-Impact-Pack `NODE_CLASS_MAPPINGS`에 등록된 식별자명은 접두사가 붙은 **`ImpactControlNetApplySEGS`**, **`ImpactSEGSLabelFilter`**였습니다.
* **해결 방법**:
  * JSON 파일의 type 정의 부분을 실제 등록 식별자 명칭으로 전면 교정했습니다.

### 2-3. `SEGSSwitch` 입력 핀 매핑 불일치 오류 (`NoneType` 에러)
* **오류 메시지**: `'NoneType' object is not subscriptable` (SEGSDetailer 입력단에서 발생)
* **원인**:
  * A/B 테스트용으로 추가했던 `SEGSSwitch` 노드는 내부적으로 `input1`/`input2` 포트명을 기대하지만, 실제 생성 시에는 `segs1`/`segs2`로 명명되어, 스위치 토글 시 `None` 값이 디테일러로 흘러들어갔습니다.
* **해결 방법**:
  * 오류를 유발하는 스위치를 완전 소거하고, ControlNet을 적용한 파이프라인과 우회(Bypass)한 파이프라인을 병렬로 동시 수행하여 각각 별개의 파일(`with_controlnet`/`no_controlnet`)로 한 번에 출력 및 저장해 주는 **듀얼 병렬 파이프라인**을 신규 빌드하여 검증 효율을 극대화했습니다.

---

## 3. 알고리즘 및 파라미터 튜닝 오류

### 3-1. 필터 텍스트 대소문자 구분 및 공백 매칭 오류 (동작 스킵 현상)
* **현상**: prompt 실행이 0.29초 만에 종료되며 결과물이 원본과 픽셀 단위로 똑같이 나오는 현상.
* **원인**: 
  * `SEGSLabelFilter` 의 파싱 로직이 대소문자를 구분(Case-sensitive)하는 방식이었기 때문에, YOLOv8 감지기가 분류해 낸 `"Coffee table"` (첫 글자 대문자)과 labels에 소문자로 지정했던 `"coffee table"`이 매치되지 않아 탐지 대상에서 제외(0건 처리)되었습니다. 그 결과 인페인팅 연산 자체가 완전히 건너뛰어졌습니다.
* **해결 방법**:
  * 콤마 뒤 공백을 제거하고 대소문자 분류명을 복합 기입하여 매칭 누락을 방지했습니다.
  * **수정 값**: `chair,couch,bed,dining table,table,coffee table,Chair,Couch,Bed,Dining table,Table,Coffee table`

### 3-2. `crop_factor` 과도 설정으로 인한 여백 쏠림 현상 (변환 무반응)
* **현상**: 세그멘테이션 감지는 되었으나 크롭된 영역 대부분이 검은색 여백이며 결과물이 거의 변하지 않음.
* **원인**:
  * `crop_factor`가 `3.0`으로 과도하게 커서, 해상도가 작은 이미지 내의 가구를 크롭할 때 감지 면적의 3배 영역을 잡았습니다. 이로 인해 이미지 바깥 범위(여백)가 검은색으로 대량 크롭되어 들어갔고, SD 인페인팅 모델이 가구가 아닌 빈 배경에만 렌더링을 집중하여 변화를 만들어내지 못했습니다.
* **해결 방법**:
  * `crop_factor` 수치를 **`1.5`**로 하향 튜닝하여, 여백 쏠림 현상을 전면 해결하고 크롭 렌더링 초점을 가구 본연의 픽셀에 완벽히 고정했습니다.

### 3-3. 가구 완전 재창조를 위한 파라미터 임계치 및 융합 튜닝
* **조치 및 최적 설정값**:
  * **Denoise `1.0`**: 원본 형태의 고집(ControlNet)을 완전히 걷어내고 프롬프트에 입각해 가구를 100% 새로이 드로잉.
  * **Steps `30` / CFG `9.5`**: 에메랄드 벨벳 질감과 곡선형 스타일을 고화질로 묘사하기 위한 렌더링 강도 보정.
  * **Negative Prompt 억제**: `"same as original, unchanged design"` 등을 추가해 원본으로 회귀하려는 AI 습성을 인위적으로 억제.
  * **Feather `30` 상향**: ControlNet 배제 시 발생 가능한 합성 경계면 단차(Seam) 부작용을 예방하기 위해, 경계면 융합 범위를 20px에서 30px로 넓혀 주변 배경과 부드러운 그라데이션 페더링을 적용함.
