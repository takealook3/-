# update_db3.py
# ─────────────────────────────────────────────────────────────────────────────
# backend/DB1.csv(31열)와 Downloads/DB3.csv(31열)를 지능적으로 병합하여
# 겹치는 스타일은 DB3 기준으로 덮어쓰고, DB3에만 있는 신규 스타일은 추가하고,
# DB1에만 있는 고유 스타일은 유지하는 스크립트입니다.
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import csv
import json
import re

# Windows 환경 인코딩 강제 매칭
if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

def clean_image_url(image_raw):
    """
    엑셀 이미지 수식 '=IMAGE("https://...")' 형태에서 순수한 URL 문자열만 추출합니다.
    """
    image_raw = image_raw.strip()
    if not image_raw:
        return ""
    match = re.search(r'"(https?://[^"]+)"', image_raw)
    if match:
        return match.group(1)
    if image_raw.startswith("http"):
        return image_raw
    return ""

def merge_db3():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db1_path = os.path.join(base_dir, "DB1.csv")
    db3_path = r"c:\Users\USER\Downloads\DB3.csv"
    
    frontend_dir = os.path.abspath(os.path.join(base_dir, "..", "frontend", "src", "components"))
    target_images_json = os.path.join(frontend_dir, "styles_images.json")
    target_db_json = os.path.join(frontend_dir, "styles_db.json")

    print("1. DB 병합 준비 및 유효성 검사 중...")
    if not os.path.exists(db1_path) or not os.path.exists(db3_path):
        print("❌ 오류: DB1.csv 또는 DB3.csv 파일 경로를 찾을 수 없습니다.")
        return

    # 스타일 한글명을 키로 삼는 병합 딕셔너리
    merged_styles = {}

    # Step A. 기존 DB1.csv 로드
    print("2. 기존 DB1.csv 데이터를 로드하는 중...")
    with open(db1_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        db1_header = next(reader)
        for row in reader:
            if not row or len(row) < 2:
                continue
            name_ko = row[1].strip()
            # 31열 포맷을 안전하게 보존하기 위해 강제 31열 패딩
            padded_row = row + [""] * (31 - len(row))
            merged_styles[name_ko] = padded_row

    # Step B. DB3.csv 데이터를 로드하며 병합 (DB3 기준 덮어쓰기 및 신규 추가)
    print("3. DB3.csv 데이터를 로드하여 병합(중복 시 덮어쓰기, 부재 시 추가) 중...")
    with open(db3_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        db3_header = next(reader)
        for row in reader:
            if not row or len(row) < 2:
                continue
            name_ko = row[1].strip()
            # 31열 패딩
            padded_row = row + [""] * (31 - len(row))
            # DB3 데이터로 강제 오버라이트 또는 신규 추가
            merged_styles[name_ko] = padded_row

    # Step C. 정렬 및 DB1.csv 재배치
    print("4. 인덱스 번호 재배정 및 DB1.csv 작성 중...")
    # 스타일 한글명 가나다 순으로 정렬
    sorted_styles = sorted(merged_styles.items(), key=lambda x: x[0])
    
    final_rows = []
    style_list_json = []
    style_images_map = {}
    
    # 헤더는 DB3 기준 31열 헤더 그대로 채용
    final_header = db3_header + [""] * (31 - len(db3_header))

    for idx, (name, row) in enumerate(sorted_styles, start=1):
        row[0] = str(idx) # 순차적 번호 재정비
        final_rows.append(row)
        
        # 프론트엔드 연동용 JSON 파싱
        name_ko = row[1].strip()
        name_en = row[2].strip()
        feat1 = row[3].strip()
        feat2 = row[4].strip()
        feat3 = row[5].strip()
        
        style_img = clean_image_url(row[6])
        kitchen_img = clean_image_url(row[7])
        bathroom_img = clean_image_url(row[8])
        sofa_img = clean_image_url(row[9])
        bed_img = clean_image_url(row[10])
        obj1_img = clean_image_url(row[11])
        obj2_img = clean_image_url(row[12])
        obj3_img = clean_image_url(row[13])
        
        target_customer = row[29].strip()
        difficulty = row[30].strip()
        description = f"{feat1}. {feat2}. {feat3}."
        
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
            
        obj_img = obj1_img or obj2_img or obj3_img
        if obj_img:
            categories.append("오브제")
            images_by_category["오브제"] = obj_img
            
        style_list_json.append({
            "id": idx,
            "name": name_ko,
            "engName": name_en,
            "desc": description,
            "target": target_customer,
            "difficulty": difficulty,
            "imageUrl": style_img,
            "categories": categories,
            "images": images_by_category
        })
        
        style_images_map[name_ko] = style_img

    # 병합 완료 DB1.csv 쓰기
    with open(db1_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(final_header)
        writer.writerows(final_rows)
    print(f"✅ 병합 완료: 총 {len(final_rows)}개 스타일이 {db1_path}에 갱신 및 저장되었습니다.")

    # 프론트엔드 연동 파일 동시 갱신
    print(f"💾 프론트엔드 JSON 빌드 중...")
    with open(target_images_json, "w", encoding="utf-8") as f:
        json.dump(style_images_map, f, ensure_ascii=False, indent=2)
    with open(target_db_json, "w", encoding="utf-8") as f:
        json.dump(style_list_json, f, ensure_ascii=False, indent=2)
    print("✨ 프론트엔드 리소스 동기화 완료!")

if __name__ == "__main__":
    merge_db3()
