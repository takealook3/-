import sys
import os
import time
import shutil
import torch

# 윈도우 OneDNN / PIR C++ 가속 버그 방지를 위한 환경변수 설정
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['FLAGS_enable_pir_in_executor'] = '0'

from PIL import Image, ImageDraw, ImageFont

# 윈도우 터미널(CP949) 출력 충돌 방지 설정
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='cp949', errors='replace')
    except Exception:
        pass

def get_memory_usage_mb():
    """현재 프로세스의 RAM(또는 GPU) 메모리 사용량(MB)을 측정하는 함수입니다."""
    gpu_mem = 0.0
    if torch.cuda.is_available():
        gpu_mem = torch.cuda.memory_allocated() / (1024 * 1024)
    
    # 시스템 RAM 측정 (ctypes 활용)
    ram_mem = 0.0
    try:
        import ctypes
        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]
        counters = PROCESS_MEMORY_COUNTERS()
        ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.windll.kernel32.GetCurrentProcess(),
            ctypes.byref(counters),
            ctypes.sizeof(counters)
        )
        ram_mem = counters.WorkingSetSize / (1024 * 1024)
    except Exception:
        pass
        
    return ram_mem, gpu_mem

def levenshtein_distance(s1, s2):
    """두 문자열 간의 레벤슈타인 편집 거리(다시 쓰기 위해 필요한 최소 수정 횟수)를 계산합니다."""
    if len(s1) > len(s2):
        s1, s2 = s2, s1
    distances = range(len(s1) + 1)
    for i2, c2 in enumerate(s2):
        distances_ = [i2+1]
        for i1, c1 in enumerate(s1):
            if c1 == c2:
                distances_.append(distances[i1])
            else:
                distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
        distances = distances_
    return distances[-1]

def calculate_accuracy(gt_list, pred_list):
    """정답 리스트와 예측 리스트 간의 정확도(%)를 계산합니다."""
    total_len = len(gt_list)
    if total_len == 0:
        return 100.0
    dist = levenshtein_distance(gt_list, pred_list)
    acc = max(0.0, (1.0 - dist / total_len)) * 100.0
    return round(acc, 2)

def draw_evaluation_visualization(image_path, results, gt_clean_chars, output_path, model_name):
    """
    OCR 판독 결과를 이미지 위에 시각화합니다.
    정답 데이터에 포함된 글자면 초록색(O), 틀리거나 노이즈이면 빨간색(X)으로 테두리와 텍스트를 그립니다.
    """
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    
    font_size = max(20, int(img.width / 50))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", size=font_size)
    except Exception:
        font = ImageFont.load_default()
        
    correct_count = 0
    incorrect_count = 0

    for bbox, text, conf in results:
        clean_text = "".join(text.split())
        is_correct = (len(clean_text) > 0) and (clean_text in gt_clean_chars)
        
        if is_correct:
            color = (0, 220, 0)
            label = f"[O] {text}"
            correct_count += 1
        else:
            color = (255, 0, 0)
            label = f"[X] {text}"
            incorrect_count += 1
            
        try:
            polygon = [tuple(map(int, pt)) for pt in bbox]
            draw.polygon(polygon, outline=color, width=4)
            
            top_left = polygon[0]
            text_pos = (top_left[0], max(0, top_left[1] - font_size - 6))
            
            bbox_text = draw.textbbox(text_pos, label, font=font)
            draw.rectangle(bbox_text, fill=color)
            draw.text(text_pos, label, fill=(255, 255, 255), font=font)
        except Exception:
            pass

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, quality=95)
    print(f"[{model_name} 시각화 저장] 맞은 항목: {correct_count}개 / 틀린 항목: {incorrect_count}개 -> '{output_path}'")

def evaluate_easyocr(sample_img, gt_clean_chars, gt_clean_words):
    """EasyOCR 엔진 벤치마크 평가를 수행합니다."""
    print("\n--------------------------------------------------")
    print("[실험 1] EasyOCR AI 속기사 평가 진행 중...")
    ram_before, gpu_before = get_memory_usage_mb()
    
    import easyocr
    use_gpu = torch.cuda.is_available()
    reader = easyocr.Reader(['ko', 'en'], gpu=use_gpu, verbose=False)
    
    ram_after, gpu_after = get_memory_usage_mb()
    mem_used = (gpu_after - gpu_before) if use_gpu else (ram_after - ram_before)
    mem_type = "GPU 메모리" if use_gpu else "시스템 RAM"
    
    start_time = time.time()
    results = reader.readtext(sample_img)
    inference_time = time.time() - start_time
    
    pred_texts = [text for (_, text, _) in results]
    pred_raw = " ".join(pred_texts)
    char_acc = calculate_accuracy(gt_clean_chars, "".join(pred_raw.split()))
    word_acc = calculate_accuracy(gt_clean_words, pred_raw.split())
    
    draw_evaluation_visualization(sample_img, results, gt_clean_chars, "./vis/vis_easyocr.jpg", "EasyOCR")
    
    return {
        "exp_id": "EXP-20260628-01",
        "name": "EasyOCR 공식 엔진 평가",
        "speed": inference_time,
        "mem": mem_used,
        "mem_type": mem_type,
        "char_acc": char_acc,
        "word_acc": word_acc
    }

def evaluate_paddleocr(sample_img, gt_clean_chars, gt_clean_words):
    """PaddleOCR 엔진 벤치마크 평가를 수행합니다."""
    print("\n--------------------------------------------------")
    print("[실험 2] PaddleOCR AI 속기사 평가 진행 중...")
    ram_before, gpu_before = get_memory_usage_mb()
    
    import paddle
    try:
        paddle.set_flags({'FLAGS_enable_pir_api': False, 'FLAGS_enable_pir_in_executor': False, 'FLAGS_use_mkldnn': False})
    except Exception:
        pass

    from paddleocr import PaddleOCR
    use_gpu = torch.cuda.is_available()
    try:
        ocr = PaddleOCR(lang='korean', device='gpu:0' if use_gpu else 'cpu')
    except Exception:
        ocr = PaddleOCR(lang='korean', use_gpu=use_gpu)
    
    ram_after, gpu_after = get_memory_usage_mb()
    mem_used = abs(ram_after - ram_before)  # PaddleOCR 시스템 RAM/GPU 측정
    mem_type = "시스템 RAM"
    
    start_time = time.time()
    # 최신 PaddleX 규격인 predict() 메서드 사용 및 예외처리
    parsed_results = []
    try:
        raw_results = list(ocr.predict(sample_img))
        for item in raw_results:
            # 1. PaddleX Result 딕셔너리/객체 구조 파싱
            if hasattr(item, 'keys') or isinstance(item, dict):
                dt_polys = item['dt_polys'] if 'dt_polys' in item else (item['rec_polys'] if 'rec_polys' in item else getattr(item, 'dt_polys', []))
                rec_text = item['rec_texts'] if 'rec_texts' in item else (item['rec_text'] if 'rec_text' in item else getattr(item, 'rec_texts', []))
                rec_score = item['rec_scores'] if 'rec_scores' in item else (item['rec_score'] if 'rec_score' in item else getattr(item, 'rec_scores', []))
                if dt_polys is not None and rec_text is not None:
                    for i in range(min(len(dt_polys), len(rec_text))):
                        parsed_results.append((dt_polys[i], str(rec_text[i]), float(rec_score[i]) if i < len(rec_score) else 1.0))
            # 2. 기존 3중 리스트 구조 파싱
            elif isinstance(item, (list, tuple)):
                for line in item:
                    if isinstance(line, (list, tuple)) and len(line) >= 2:
                        bbox = line[0]
                        text_info = line[1]
                        if isinstance(text_info, (list, tuple)) and len(text_info) >= 1:
                            parsed_results.append((bbox, str(text_info[0]), float(text_info[1]) if len(text_info) >= 2 else 1.0))
    except Exception as e:
        print(f"[예외 발생] PaddleOCR 추론 중 에러: {e}")
        
    inference_time = time.time() - start_time
    
    pred_texts = [text for (_, text, _) in parsed_results]
    pred_raw = " ".join(pred_texts)
    char_acc = calculate_accuracy(gt_clean_chars, "".join(pred_raw.split()))
    word_acc = calculate_accuracy(gt_clean_words, pred_raw.split())
    
    draw_evaluation_visualization(sample_img, parsed_results, gt_clean_chars, "./vis/vis_paddleocr.jpg", "PaddleOCR")
    
    return {
        "exp_id": "EXP-20260628-02",
        "name": "PaddleOCR 공식 엔진 평가",
        "speed": inference_time,
        "mem": mem_used,
        "mem_type": mem_type,
        "char_acc": char_acc,
        "word_acc": word_acc
    }

def run_evaluation():
    print("==================================================")
    print(" [AI OCR 속기사 통합 챔피언십 벤치마크 평가] ")
    print("==================================================")
    
    sample_img = "ocr-sample.jpeg"
    if not os.path.exists(sample_img):
        fallback_img = "Image20260628120828.jpg"
        if os.path.exists(fallback_img):
            shutil.copy(fallback_img, sample_img)
            
    gt_file = "ocr-gt.txt"
    with open(gt_file, "r", encoding="utf-8") as f:
        gt_raw = f.read()
    gt_clean_chars = "".join(gt_raw.split())
    gt_clean_words = gt_raw.split()
    print(f"[정답 기준] 총 글자: {len(gt_clean_chars)}자 / 총 단어: {len(gt_clean_words)}개")

    res1 = evaluate_easyocr(sample_img, gt_clean_chars, gt_clean_words)
    res2 = evaluate_paddleocr(sample_img, gt_clean_chars, gt_clean_words)
    
    print("\n==================================================")
    print("          [ 🏆 통합 벤치마크 최종 결과표 ]          ")
    print("==================================================")
    print(f"[{res1['exp_id']}] {res1['name']}")
    print(f"  - 속도: {res1['speed']:.3f}초 | 소모 메모리: {res1['mem']:.2f} MB")
    print(f"  - 글자 정확도: {res1['char_acc']}% | 단어 정확도: {res1['word_acc']}%")
    print("--------------------------------------------------")
    print(f"[{res2['exp_id']}] {res2['name']}")
    print(f"  - 속도: {res2['speed']:.3f}초 | 소모 메모리: {res2['mem']:.2f} MB")
    print(f"  - 글자 정확도: {res2['char_acc']}% | 단어 정확도: {res2['word_acc']}%")
    print("==================================================")

if __name__ == "__main__":
    run_evaluation()
