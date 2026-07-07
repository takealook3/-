# -*- coding: utf-8 -*-
# clip_test.py
# ─────────────────────────────────────────────────────────────────────────────
# 🎨 산디과 코딩 가이드 적용: CLIP 3가지 핵심 기능 테스트 데모 스크립트
#
# 이 스크립트는 터미널에서 `python clip_test.py`를 실행하여 
# 다음 세 가지 기능이 어떻게 시각적 데이터를 비교하고 매칭하는지 보여줍니다:
#   1. 이미지 -> 텍스트 매칭 (이미지 분석 후 가장 어울리는 설명글 고르기)
#   2. 텍스트 -> 이미지 검색 (설명글을 입력하여 가장 적합한 이미지 사진 찾기)
#   3. 이미지 -> 이미지 검색 (특정 이미지와 가장 닮은 다른 이미지들 추천하기)
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys

# 윈도우 터미널 한글 출력 및 특수 문자 출력 깨짐(cp949 에러) 방지
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# 백엔드 코드를 불러올 수 있도록 sys.path 경로 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(current_dir, "backend"))

from services.clip_service import CLIPService

def run_clip_demo():
    print("=" * 70)
    print("[CLIP 비주얼 검색 엔진 데모 기동]")
    print("=" * 70)
    
    # 1. CLIP 서비스 초기화 (최초 실행 시 인터넷에서 모델을 자동으로 다운받느라 조금 걸릴 수 있습니다)
    try:
        clip = CLIPService()
    except Exception as e:
        print(f"[오류] CLIP 서비스를 로드하지 못했습니다: {e}")
        print("가상환경 패키지 상태 또는 인터넷 연결을 확인해 주세요.")
        return

    # 2. 테스트용 이미지 폴더 경로 설정 (QUIZ images의 실제 이미지들을 활용합니다)
    quiz_img_dir = os.path.join(current_dir, "QUIZ images")
    if not os.path.exists(quiz_img_dir):
        print(f"[오류] 테스트할 'QUIZ images' 디렉터리가 보이지 않습니다. 경로: {quiz_img_dir}")
        return
    
    # 디렉터리 내 이미지들 스캔 (.jpg, .jpeg, .png)
    all_images = [
        os.path.join(quiz_img_dir, f)
        for f in os.listdir(quiz_img_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ]
    
    if not all_images:
        print("[오류] 'QUIZ images' 폴더 내에 이미지 파일이 없습니다.")
        return
    
    print(f"📂 분석용 이미지 데이터베이스 로드 성공 (총 {len(all_images)}개의 이미지 스캔 완료)")
    print("-" * 70)

    # -------------------------------------------------------------------------
    # 1단계. 이미지 -> 텍스트 (Image to Text) 매칭 데모
    # -------------------------------------------------------------------------
    print("\n[1단계] 이미지 -> 텍스트 매칭 (Image-to-Text)")
    print("설명: 한 장의 이미지를 주고, 여러 텍스트 후보 중 무엇과 가장 어울리는지 맞추게 합니다.")
    
    # 타겟 이미지 설정
    target_img_name = "베이지 브라운 패브릭 소파.jpg"
    target_img_path = os.path.join(quiz_img_dir, target_img_name)
    
    if os.path.exists(target_img_path):
        print(f"입력 이미지: '{target_img_name}'")
        
        # 영어 기반의 CLIP 모델 특성을 반영하여 직관적인 영어 묘사 후보군을 둡니다.
        text_candidates = [
            "a cozy beige fabric sofa in a bright living room",
            "a modern black leather chair for office",
            "a neat bedroom with a white cozy bed",
            "green tropical plants in a ceramic pot",
            "a rustic wooden dining table with chairs"
        ]
        
        print("비교 대상 텍스트 후보들:")
        for idx, text in enumerate(text_candidates, 1):
            print(f"  {idx}. \"{text}\"")
            
        print("\n유사도 분석 중...")
        matching_texts = clip.search_image_to_text(target_img_path, text_candidates)
        
        print("\n매칭 분석 결과 (유사도 순):")
        print(f"{'순위':^4} | {'유사도 점수':^10} | {'매칭 텍스트 묘사'}")
        print("-" * 65)
        for rank, res in enumerate(matching_texts, 1):
            star = "*" if rank == 1 else "  "
            print(f"{rank:^4} | {res['similarity']:^10.4f} | {res['text']} {star}")
    else:
        print(f"경고: 테스트 이미지 '{target_img_name}'가 존재하지 않아 1단계를 건너뜁니다.")

    print("-" * 70)

    # -------------------------------------------------------------------------
    # 2단계. 텍스트 -> 이미지 (Text to Image) 검색 데모
    # -------------------------------------------------------------------------
    print("\n[2단계] 텍스트 -> 이미지 검색 (Text-to-Image)")
    print("설명: 텍스트 검색어를 입력하여, 데이터베이스 이미지 중 가장 알맞은 사진들을 검색합니다.")
    
    text_query = "wood furniture and warm cozy lighting"
    print(f"입력 검색어: \"{text_query}\"")
    print("전체 이미지 라이브러리 스캔 및 검색 중...")
    
    matching_images = clip.search_text_to_image(text_query, all_images)
    
    print("\n검색 결과 상위 3선:")
    print(f"{'순위':^4} | {'유사도 점수':^10} | {'매칭 이미지 파일명'}")
    print("-" * 65)
    for rank, res in enumerate(matching_images[:3], 1):
        filename = os.path.basename(res['image_path'])
        print(f"{rank:^4} | {res['similarity']:^10.4f} | {filename} *")

    print("-" * 70)

    # -------------------------------------------------------------------------
    # 3단계. 이미지 -> 이미지 (Image to Image) 시각적 유사도 추천 데모
    # -------------------------------------------------------------------------
    print("\n[3단계] 이미지 -> 이미지 검색 (Image-to-Image)")
    print("설명: 기준 이미지와 시각적(형태, 색상, 레이아웃)으로 가장 닮은 사진들을 유사도 높은 순으로 찾아줍니다.")
    
    # 기준 이미지 설정 (베이지 브라운 패브릭 소파)
    query_img_name = "베이지 브라운 패브릭 소파.jpg"
    query_img_path = os.path.join(quiz_img_dir, query_img_name)
    
    if os.path.exists(query_img_path):
        print(f"기준 이미지: '{query_img_name}'")
        print("유사 가구/인테리어 이미지 검색 중 (자기 자신 제외)...")
        
        # 검색 대상에서 자기 자신은 제외합니다
        db_images = [img for img in all_images if os.path.basename(img) != query_img_name]
        
        similar_images = clip.search_image_to_image(query_img_path, db_images)
        
        print("\n시각적 유사 추천 상위 3선:")
        print(f"{'순위':^4} | {'유사도 점수':^10} | {'추천된 유사 이미지 파일명'}")
        print("-" * 65)
        for rank, res in enumerate(similar_images[:3], 1):
            filename = os.path.basename(res['image_path'])
            print(f"{rank:^4} | {res['similarity']:^10.4f} | {filename} *")
    else:
        print(f"경고: 기준 이미지 '{query_img_name}'가 존재하지 않아 3단계를 건너뜁니다.")

    print("\n" + "=" * 70)
    print("[CLIP 데모 테스트 성공 완료]")
    print("=" * 70)

if __name__ == "__main__":
    run_clip_demo()
