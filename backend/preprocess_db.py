# preprocess_db.py
# ─────────────────────────────────────────────────────────────────────────────
# db1111.csv 파일을 파싱하여 RAG용 DB1.csv를 생성하고,
# 프론트엔드 연동용 JSON 데이터베이스들을 자동 빌드하는 전처리 스크립트입니다.
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import csv
import re
import json

# Windows 터미널의 cp949 인코딩 문제 방지를 위해 stdout의 인코딩을 UTF-8로 강제 재설정합니다.
if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)


def clean_image_url(image_raw):
    """
    엑셀 이미지 수식 '=IMAGE("https://...")' 형태에서 순수한 URL 문자열만 추출합니다.
    """
    image_raw = image_raw.strip()
    if not image_raw:
        return ""
    # 큰따옴표 안의 http/https로 시작하는 URL 추출
    match = re.search(r'"(https?://[^"]+)"', image_raw)
    if match:
        return match.group(1)
    # 수식이 아닌 일반 URL 형태일 경우 그대로 반환
    if image_raw.startswith("http"):
        return image_raw
    return ""

def preprocess():
    # 경로 설정
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(base_dir, "DB1.csv") # [수정] 다운로드 폴더가 아닌 로컬 백엔드의 DB1.csv를 원본으로 사용
    target_csv_path = os.path.join(base_dir, "DB1.csv")
    
    frontend_dir = os.path.abspath(os.path.join(base_dir, "..", "frontend", "src", "components"))
    target_images_json = os.path.join(frontend_dir, "styles_images.json")
    target_db_json = os.path.join(frontend_dir, "styles_db.json")
    
    print(f"🔍 원본 파일 확인 중: {source_path}")
    if not os.path.exists(source_path):
        print(f"❌ 오류: 원본 파일 '{source_path}'이 존재하지 않습니다.")
        return

    # 1. 원본 파일 로드 및 정제 작업 수행
    style_list = []
    style_images_map = {}
    
    with open(source_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader) # 헤더 스킵
        
        # 28가지 스타일 데이터 가공
        for row in reader:
            if not row or len(row) < 25:
                continue
            
            # 컬럼 매핑 정보 (db1111.csv 기준)
            num = int(row[0].strip())
            name_ko = row[1].strip()
            name_en = row[2].strip()
            feat1 = row[3].strip()
            feat2 = row[4].strip()
            feat3 = row[5].strip()
            
            # 이미지 컬럼들 정제
            style_img = clean_image_url(row[6])
            kitchen_img = clean_image_url(row[7])
            bathroom_img = clean_image_url(row[8])
            sofa_img = clean_image_url(row[9])
            bed_img = clean_image_url(row[10])
            obj1_img = clean_image_url(row[11])
            obj2_img = clean_image_url(row[12])
            obj3_img = clean_image_url(row[13])
            
            # 벽지 및 바닥 정보
            wallpaper_name = row[14].strip()
            wallpaper_img = clean_image_url(row[15])
            flooring_name = row[16].strip()
            flooring_img = clean_image_url(row[17])
            
            # 기타 타겟층 및 난이도
            target_customer = row[29].strip() if len(row) > 29 else ""
            difficulty = row[30].strip() if len(row) > 30 else ""
            
            # 설명문 제작 (특징 3가지 조합)
            description = f"{feat1}. {feat2}. {feat3}."
            
            # 사용 가능한 가구 카테고리 도출
            categories = []
            images_by_category = {
                "스타일": style_img
            }
            
            if bed_img:
                categories.append("침대")
                images_by_category["침대"] = bed_img
            if sofa_img:
                categories.append("소파")
                images_by_category["소파"] = sofa_img
            if kitchen_img:
                categories.append("주방")
                images_by_category["주방"] = kitchen_img
            if bathroom_img:
                categories.append("화장실")
                images_by_category["화장실"] = bathroom_img
            # 오브제는 존재하는 모든 오브제 이미지(1, 2, 3)를 개별 키로 이식
            if obj1_img or obj2_img or obj3_img:
                categories.append("오브제")
                if obj1_img:
                    images_by_category["오브제1"] = obj1_img
                if obj2_img:
                    images_by_category["오브제2"] = obj2_img
                if obj3_img:
                    images_by_category["오브제3"] = obj3_img
                images_by_category["오브제"] = obj1_img or obj2_img or obj3_img
                
            # 프론트엔드용 JSON 구성요소 추가
            style_list.append({
                "id": num,
                "name": name_ko,
                "engName": name_en,
                "desc": description,
                "target": target_customer,
                "difficulty": difficulty,
                "imageUrl": style_img,
                "categories": categories,
                "images": images_by_category
            })
            
            # Featured Collections용 썸네일 이미지 맵 빌드
            style_images_map[name_ko] = style_img

    # 2. backend/DB1.csv 자리에 파일 복사 (단, 원본과 대상이 다를 때만 복사)
    if os.path.abspath(source_path) != os.path.abspath(target_csv_path):
        print(f"💾 백엔드 DB 복사 중: {target_csv_path}")
        import shutil
        shutil.copy(source_path, target_csv_path)
    
    # 3. 프론트엔드 JSON 파일들 쓰기
    if not os.path.exists(frontend_dir):
        os.makedirs(frontend_dir)
        
    print(f"💾 프론트엔드 이미지 맵 저장 중: {target_images_json}")
    with open(target_images_json, "w", encoding="utf-8") as f:
        json.dump(style_images_map, f, ensure_ascii=False, indent=2)
        
    print(f"💾 프론트엔드 스타일 DB 저장 중: {target_db_json}")
    with open(target_db_json, "w", encoding="utf-8") as f:
        json.dump(style_list, f, ensure_ascii=False, indent=2)

    print("✨ 전처리 및 데이터 연동 파일 빌드 완료!")

if __name__ == "__main__":
    preprocess()
