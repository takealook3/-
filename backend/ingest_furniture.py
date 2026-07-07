# -*- coding: utf-8 -*-
# backend/ingest_furniture.py
# ─────────────────────────────────────────────────────────────────────────────
# 🎨 산디과 코딩 가이드 적용: 가구 이미지 및 메타데이터 Chroma DB 적재 스크립트
#
# 비유: 가구 카탈로그(CSV)에 있는 수많은 가구 사진 링크를 타고 들어가 
# 사진을 받아온 뒤(다운로드), CLIP이라는 AI 미술가에게 사진의 느낌을 
# 512가지 숫자 특징(임베딩)으로 받아내고, 이를 가구 정보 액자(메타데이터)와 함께 
# 거대한 가구 박물관 창고(Chroma DB 컬렉션)에 고이 보관하는 시스템입니다.
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import csv
import argparse
import requests
import time
from io import BytesIO
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_community.vectorstores import Chroma

# 윈도우 cp949 한글 깨짐 에러 방지
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 백엔드 경로를 sys.path에 추가하여 config 및 서비스를 불러옵니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

import config
from services.clip_service import CLIPService

def download_image(url, timeout=10):
    """
    주어진 이미지 URL에서 이미지를 다운로드하여 PIL Image 객체로 반환하는 헬퍼 함수입니다.
    """
    try:
        # User-Agent를 브라우저처럼 위장하여 네이버 쇼핑 이미지 크롤링 차단을 우회합니다.
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            # 바이너리 바이트 스트림을 PIL 이미지 객체로 변환하여 메모리에 로드
            return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception:
        # 다운로드 중 타임아웃이나 연결 실패 등의 오류가 생겨도 전체 동작을 멈추지 않고 넘어갑니다.
        pass
    return None

def process_batch(batch_rows, clip_service, num_threads):
    """
    1개 배치 분량의 행 데이터를 받아서 병렬 다운로드 및 CLIP 임베딩 추출을 수행합니다.
    """
    downloaded_items = []
    
    # 1. ThreadPoolExecutor를 이용한 병렬 이미지 다운로드 (I/O Bound 작업 최적화)
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        # 각 행에 대해 다운로드 작업을 매핑
        future_to_row = {}
        for row in batch_rows:
            url = row.get("image_url", "").strip()
            if url:
                future = executor.submit(download_image, url)
                future_to_row[future] = row
            else:
                print(f"⚠️ 경고: [ID {row.get('id')}] 이미지 URL이 비어 있어 건너뜁니다.")
        
        # 다운로드 완료 순서대로 수집
        for future in as_completed(future_to_row):
            row = future_to_row[future]
            try:
                pil_image = future.result()
                if pil_image:
                    # 다운로드 성공 시 이미지 객체와 기존 메타데이터 행 정보를 묶어서 저장
                    downloaded_items.append((pil_image, row))
                else:
                    print(f"❌ 다운로드 실패: [ID {row.get('id')}] URL: {row.get('image_url')[:60]}...")
            except Exception as e:
                print(f"❌ 다운로드 예외 발생: [ID {row.get('id')}] {e}")

    # 2. 수집된 이미지들의 CLIP 임베딩 추출 (CPU/GPU Bound 작업 - 스레드 안전하게 순차 처리)
    embeddings = []
    ids = []
    documents = []
    metadatas = []
    
    for pil_image, row in downloaded_items:
        try:
            # CLIP 모델에 이미지를 제공하여 512차원 특징 벡터 추출
            embedding = clip_service.get_image_embedding(pil_image)
            if embedding:
                # 고유 키로 네이버 상품 ID(product_id)를 지정합니다
                product_id = row.get("product_id", "").strip()
                if not product_id:
                    # product_id가 없으면 일반 id를 사용
                    product_id = f"custom_id_{row.get('id')}"
                
                # Chroma DB에 등록할 형태별 리스트 구성
                ids.append(product_id)
                embeddings.append(embedding)
                documents.append(row.get("product_name", "").strip()) # 텍스트 검색 대비용 문서 내용
                
                # 메타데이터 딕셔너리 정제
                metadata = {
                    "id": row.get("id", "").strip(),
                    "product_id": product_id,
                    "product_name": row.get("product_name", "").strip(),
                    "image_url": row.get("image_url", "").strip(),
                    "price": int(row.get("price")) if row.get("price", "").strip().isdigit() else 0,
                    "mall_name": row.get("mall_name", "").strip(),
                    "link": row.get("link", "").strip(),
                    "category1": row.get("category1", "").strip(),
                    "category2": row.get("category2", "").strip(),
                    "category3": row.get("category3", "").strip(),
                    "category4": row.get("category4", "").strip(),
                    "brand": row.get("brand", "").strip()
                }
                metadatas.append(metadata)
            else:
                print(f"❌ 임베딩 추출 실패: [ID {row.get('id')}] {row.get('product_name')[:20]}")
        except Exception as e:
            print(f"❌ 임베딩 오류: [ID {row.get('id')}] {e}")
            
    return ids, embeddings, documents, metadatas

def run_ingestion():
    parser = argparse.ArgumentParser(description="CSV 가구 이미지 정보를 Chroma DB에 벡터 적재합니다.")
    parser.add_argument("--limit", type=int, default=None, help="적재할 최대 가구 데이터 수 (개발/테스트 목적)")
    parser.add_argument("--reset", action="store_true", help="기존 가구 이미지 컬렉션을 초기화하고 새로 적재할지 여부")
    parser.add_argument("--batch-size", type=int, default=50, help="한 번에 처리 및 DB 저장할 배치 크기 (기본값: 50)")
    parser.add_argument("--threads", type=int, default=8, help="이미지 병렬 다운로드 스레드 수 (기본값: 8)")
    args = parser.parse_args()

    csv_path = os.path.join(BASE_DIR, "DB3_furniture.csv")
    
    print("=" * 70)
    print("🎨 [Chroma DB 가구 이미지 벡터 적재 시작]")
    print("-" * 70)
    print(f"📂 가구 데이터 CSV 경로: {csv_path}")
    print(f"🛠️ 설정 - 배치 크기: {args.batch_size}, 다운로드 스레드 수: {args.threads}")
    if args.limit:
        print(f"⚠️ 테스트 제한 모드 작동: 상위 {args.limit}개만 처리 예정")
    print("=" * 70)

    if not os.path.exists(csv_path):
        print(f"❌ 오류: '{csv_path}' 파일이 존재하지 않습니다.")
        sys.exit(1)

    # CSV 데이터 로드
    all_rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            all_rows.append(row)

    # limit 설정 시 데이터 제한
    if args.limit:
        all_rows = all_rows[:args.limit]

    total_count = len(all_rows)
    print(f"📊 총 {total_count}개의 가구 데이터를 처리합니다.")

    # 1. CLIP 임베딩 서비스 초기화
    print("\n[Step 1] CLIP 임베딩 엔진(모델) 로드 중...")
    clip_service = CLIPService()
    
    # 2. Chroma DB 컬렉션 초기화 및 로드
    print("\n[Step 2] Chroma DB 컬렉션 연결 중...")
    # Langchain의 Chroma를 빈 임베딩 함수로 로드하여, 수동 임베딩 적재를 위한 핸들을 얻습니다.
    # (여기서 embedding_function=None으로 셋업하면 텍스트 검색을 기본 제공하진 않으나, 이미지 임베딩 벡터로 커스텀 검색이 가능합니다.)
    vector_store = Chroma(
        collection_name=config.COLLECTION_FURNITURE,
        embedding_function=None,
        persist_directory=config.DB_DIR
    )
    
    # 만약 --reset 옵션이 켜져 있거나 초기화가 필요할 때 데이터 비우기
    db_data = vector_store.get()
    if args.reset:
        if db_data and db_data.get('ids'):
            print(f"🧹 [컬렉션 초기화] 기존에 저장된 데이터 {len(db_data['ids'])}개를 삭제하고 비웁니다...")
            vector_store.delete(ids=db_data['ids'])
            print("✨ 기존 컬렉션 초기화 완료!")
    else:
        if db_data and db_data.get('ids'):
            print(f"ℹ️ 정보: 현재 컬렉션에 {len(db_data['ids'])}개의 데이터가 이미 보존되어 있습니다.")
            print("  (새 데이터를 이어서 덮어씌우거나 추가합니다. 처음부터 다시 적재하려면 --reset 인자를 함께 기입해 실행하십시오.)")

    # 3. 배치 단위 처리 루프 실행
    print("\n[Step 3] 다운로드 및 임베딩 처리 루프 가동...")
    start_time = time.time()
    success_total = 0
    
    for i in range(0, total_count, args.batch_size):
        batch_rows = all_rows[i:i + args.batch_size]
        print(f"\n🔄 배치 작업 진행 중: [{i}/{total_count}] ~ [{min(i + args.batch_size, total_count)}/{total_count}]")
        
        # 병렬 다운로드 및 임베딩 계산 실행
        ids, embeddings, documents, metadatas = process_batch(
            batch_rows=batch_rows,
            clip_service=clip_service,
            num_threads=args.threads
        )
        
        # 적재할 데이터가 있는 경우 Chroma DB에 Batch 쓰기
        if ids:
            try:
                # Langchain 내부의 원본 chromadb _collection 인스턴스에 직접 임베딩 리스트 전달
                vector_store._collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
                success_total += len(ids)
                print(f"✅ 이번 배치에서 {len(ids)}개의 아이템을 Chroma DB에 성공적으로 적재했습니다! (누적 성공: {success_total})")
            except Exception as e:
                print(f"❌ DB 적재 실패: 배치 [{i} ~ {i + len(batch_rows)}] 저장 도중 오류 발생: {e}")
        else:
            print("⚠️ 이번 배치에서는 다운로드 및 임베딩에 성공한 항목이 없어 적재를 스킵합니다.")

    end_time = time.time()
    elapsed = end_time - start_time
    print("\n" + "=" * 70)
    print("✨ [가구 이미지 벡터 적재 완료!]")
    print("-" * 70)
    print(f"📈 최종 적재 완료 개수: {success_total} / {total_count}")
    print(f"⏱️ 소요 시간: {elapsed:.2f}초 (평균 아이템당 {elapsed/max(1, success_total):.2f}초)")
    print("=" * 70)

if __name__ == "__main__":
    run_ingestion()
