"""
ingest_en.py
─────────────────────────────────────────────────────────────────────────────
모든 데이터를 영어로 번역하여 ChromaDB에 적재합니다.

컬렉션:
  - interior_checklist_en   : 인테리어 공정 체크리스트 (영어)
  - interior_law_standard_en: 실내건축 기준 법령 (영어)

영어로 저장하는 이유:
  - qwen3.5:0.8b 같은 소형 모델은 영어 이해·생성 성능이 한국어보다 우수
  - 영어 임베딩의 의미론적 정밀도가 높아 벡터 검색 품질 향상
  - KO → EN → KO 파이프라인으로 최종 답변은 한국어로 출력
"""

import os
import sys
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

load_dotenv()

DB_DIR = "./chroma_db"
SOURCE_LAW       = "Ministry of Land, Infrastructure and Transport Notice No. 2026-38 (Effective 2026.01.22)"
SOURCE_CHECKLIST = "https://www.lxzin.com/styling/style-guide/detail/7398"

# ══════════════════════════════════════════════════════════════════════════════
# 1. 인테리어 공정 체크리스트 (영어)
# ══════════════════════════════════════════════════════════════════════════════
CHECKLIST_CHUNKS_EN: list[Document] = [
    Document(
        page_content="""\
# [Pre-Construction] Final Preparation Checklist
Essential final preparation steps before starting interior construction to prevent legal issues and neighbor disputes.

1. Confirm completion date: Coordinate with furniture delivery and move-in schedule
2. Agreements and administrative procedures:
   - Obtain resident consent forms (mandatory for apartments/multi-family housing per management office requirements)
   - Verify legal permits required (e.g., expansion work may require activity permit application)
   - Get written consent and prior understanding from adjacent units (above, below, left, right)
   - Post construction notice in elevator and bulletin board
3. Coordinate appliance and furniture delivery schedule: Arrange so items arrive after finishing work is complete
4. Identify any special site conditions (water damage traces, aging infrastructure)
5. Confirm construction sequence and finalize overall schedule""",
        metadata={
            "source": SOURCE_CHECKLIST,
            "title": "Interior Construction Process Checklist",
            "category": "Pre-Construction",
            "process": "Final Preparation",
        },
    ),
    Document(
        page_content="""\
# [During Construction] Foundation & Structural Work (Demolition / Plumbing / Windows / Insulation)
Key checks during the phase where the structural framework is established.

1. Demolition and plumbing:
   - Verify compliance with structural/non-structural wall demolition regulations
   - Inspect pipe relocation and waterproofing work condition
2. Windows and insulation (critical):
   - Windows directly affect insulation performance; strongly consider replacement for buildings over 15 years old
   - Precise measurements must be completed at least 7-10 days before scheduled installation
   - After installation, carefully inspect silicone sealing and adhesive residue cleanup
   - For expanded spaces needing insulation improvement, regularly verify use of high-performance materials such as urethane foam or PF board during carpentry phase""",
        metadata={
            "source": SOURCE_CHECKLIST,
            "title": "Interior Construction Process Checklist",
            "category": "During Construction",
            "process": "Demolition, Plumbing, Windows, Insulation",
        },
    ),
    Document(
        page_content="""\
# [During Construction] Finishing & Surface Work (Carpentry / Electrical / Tile / Wallpaper / Flooring / Furniture)
Checklist for the phase where the interior shape is formed and surfaces are finished.

1. Carpentry and first electrical phase: Install partition walls, repair ceilings, position lighting wiring
2. Finishing work (tile, painting & film, flooring, wallpaper):
   - Tile: Check levelness and grout filling to prevent hollow spots
   - Paint & film: Check for air bubbles, lifting, and corner finishing condition
   - Flooring & wallpaper: Check that seams are not warping or separating
3. Final phase (furniture and second electrical phase):
   - Check custom furniture leveling and smooth drawer operation
   - Final connection and operation test of outlets, switches, and light fixtures""",
        metadata={
            "source": SOURCE_CHECKLIST,
            "title": "Interior Construction Process Checklist",
            "category": "During Construction",
            "process": "Carpentry, Electrical, Finishing, Final",
        },
    ),
    Document(
        page_content="""\
# [Post-Construction] Required Inspection Items - Part 1: Foundation Work
Inspection phase after construction completion, focusing on infrastructure and structures not easily visible. Report any defects to the contractor immediately.

1. Demolition inspection: Verify planned area was cleanly demolished per drawings and all waste fully removed
2. Plumbing inspection: Test drain flow (drainage test), check for micro-leaks at water supply pipe connections
3. Window inspection: Check smooth opening/closing without wobbling, no draft when closed (airtightness), uniform silicone finish
4. Carpentry inspection: Verify gypsum board cuts and partition walls are properly fixed in horizontal and vertical alignment""",
        metadata={
            "source": SOURCE_CHECKLIST,
            "title": "Interior Construction Process Checklist",
            "category": "Post-Construction",
            "process": "Foundation Work Inspection (Demolition, Plumbing, Windows, Carpentry)",
        },
    ),
    Document(
        page_content="""\
# [Post-Construction] Required Inspection Items - Part 2: Finishing Materials
Inspection list directly affecting visual quality and daily usability.

1. Tile and bathroom inspection:
   - Check tile slope is correct so bathroom floor water drains properly to drain without pooling
   - Check fixtures (toilet, sink) for wobbling and silicone/white cement cracking
2. Finishing materials (film, paint, wallpaper, flooring) inspection:
   - Film/paint: Check for lifting or bubbling at corner edges
   - Wallpaper: Inspect seam gaps (note: freshly installed wallpaper may wrinkle temporarily but will smooth out in a few days)
   - Flooring: Inspect for creaking noise when walking or swollen/indented spots
3. Electrical inspection: Verify all switches control the correct lights, and circuit breakers operate normally without tripping""",
        metadata={
            "source": SOURCE_CHECKLIST,
            "title": "Interior Construction Process Checklist",
            "category": "Post-Construction",
            "process": "Finishing Materials Inspection (Tile, Bathroom, Film, Wallpaper, Flooring, Electrical)",
        },
    ),
]

# ══════════════════════════════════════════════════════════════════════════════
# 2. 실내건축 기준 법령 (영어)
# ══════════════════════════════════════════════════════════════════════════════
LAW_CHUNKS_EN: list[Document] = [
    Document(
        page_content="""\
Article 1 (Purpose)
The purpose of these standards is to establish structural and construction method standards for interior architecture pursuant to Article 26-5 of the Enforcement Rules of the Building Act, for the safe and efficient use of building interiors.""",
        metadata={"source": SOURCE_LAW, "article": "Article 1", "title": "Purpose", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 2 (Scope of Application)
(1) These standards apply to buildings under Article 52-2 of the Building Act and Article 61-2 of the Enforcement Decree as follows:
  1. Multi-use buildings (Article 2(17) of the Enforcement Decree): All standards apply except Article 9(3)
  2. Buildings under Article 3 of the Building Sales Act: All standards apply except Article 9(3)
  3. Buildings under Attached Table 1, Item 3(b) and Item 4(h) of the Enforcement Decree (only when partitioning with horizontal or horizontal-and-vertical dividers): Articles 3 and 9 apply
(2) The permitting authority may recommend that building owners of other buildings (single-family, multi-family, neighborhood facilities, etc.) apply all or part of these standards.""",
        metadata={"source": SOURCE_LAW, "article": "Article 2", "title": "Scope of Application", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 3 (Definitions)
1. 'Living room (Georil)': As defined in Article 2(1) of the Building Act — a room used for living activities
2. 'Safety glass': Safety glass per Article 16-2 of the Housing Construction Standards — tempered or laminated glass that does not produce sharp shards when broken
3. 'Flame-retardant material': Materials per Article 5 of the Building Evacuation and Fire Protection Structure Standards — materials that are slow to ignite
4. 'Non-combustible material': Materials per Article 6 — materials that do not burn
5. 'Quasi-non-combustible material': Materials per Article 7 — materials with performance equivalent to non-combustible materials""",
        metadata={"source": SOURCE_LAW, "article": "Article 3", "title": "Definitions", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 4 (Use of Non-Combustible Materials)
(1) In multi-use buildings, the interior finishing of walls and ceilings (banjae) of living rooms, main corridors, staircases, and other passageways, including underground rooms, must comply with finishing material standards under Article 24 of the Building Evacuation and Fire Protection Structure Standards.
(2) For areas other than living rooms, corridors, and staircases (such as sanitary facilities, storage, parking), walls and ceiling interior finishes must use non-combustible, quasi-non-combustible, or flame-retardant materials.
Key point: The more people gather in a building, the stronger the fire-resistant materials required for walls and ceilings.""",
        metadata={"source": SOURCE_LAW, "article": "Article 4", "title": "Use of Non-Combustible Materials", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 5 (Floor Finishing Materials) — Slip Accident Prevention Standards
1. Building entrances, common corridors, ramps: Must use anti-slip structures and materials. Common staircase treads must have non-slip pads installed.
2. Wet areas (bathrooms, restrooms, shower rooms, kitchens): Floor surface must use materials that are non-slip even when wet. For ceramic tile finishes, materials must meet the slip resistance friction standard of Korean Industrial Standard KS L 1001.
3. Non-slip pads on evacuation staircases and special evacuation staircases: Must be bright colors or fluorescent for high visibility.
4. Edges of common staircase, corridor, and ramp floors: Raised edges or grooves may be installed to prevent falls or slipping.
5. Indoor floor level differences: Must be constructed or marked in an easily identifiable form to prevent falls or slipping.
Key point: Wet area floors must use slip-resistant materials meeting KS L 1001 standards.""",
        metadata={"source": SOURCE_LAW, "article": "Article 5", "title": "Floor Finishing Materials", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 6 (Safety Railings) — Fall Accident Prevention Standards
(1) Railings installed on common staircases and common corridors:
  1. Railings on staircases and corridors open across two or more floors: Height must be 120 cm or more, made of strong and durable materials. Glass railings must use safety glass.
  2. Indoor space railings: Must be structured so infants and children cannot climb up. If there are gaps between railings, the gap must be 10 cm or less.
  3. Auxiliary handrails may be additionally installed considering users' body dimensions.
(2) When installing windows or doors facing spaces with fall risk: Safety facilities may be installed to prevent falls when opening/closing windows.
Key point: Railings on open spaces spanning 2+ floors must be at least 120 cm high, and must be designed so children cannot climb them.""",
        metadata={"source": SOURCE_LAW, "article": "Article 6", "title": "Safety Railings", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 7 (Cushioning Materials) — Collision Accident Prevention Standards
(1) Protruding parts and corners:
  1. Spaces with facilities for children or elderly: Cushioning materials must be installed on column and wall corners up to a height of 150 cm from the floor, or corners must be rounded.
  2. Indoor playground floors and walls: Cushioning materials must be installed to reduce impact when running or falling.
(2) Glass-finished areas:
  1. Glass doors: Must use safety glass, and must be constructed with visible markings (stickers, etc.) to identify the glass.
  2. Shower booth glass in bathrooms: Must use safety glass.
Key point: Sharp corners and glass in spaces frequented by children and elderly must be made safe.""",
        metadata={"source": SOURCE_LAW, "article": "Article 7", "title": "Cushioning Materials", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 8 (Interior Doors) — Entrapment Prevention and Emergency Opening Standards
(1) Effective width of living room entrance: 80 cm or more (except special cases), floor threshold must not protrude.
(2) Entrapment prevention construction standards:
  1. Doors must connect directly to corridors or wide spaces for easy evacuation during emergencies.
  2. Building interior entrance doors (excluding internal room doors): Must install speed control devices to prevent sudden opening/closing.
  3. Doors that open in both directions: Must install soft cushioning material for entrapment prevention (for automatic doors: entrapment and impact prevention cushioning).
  4. Hinge-side corners of internal room doors: Must install finger entrapment prevention devices.
(3) If building entrance is an automatic door: A call bell for facility manager may be installed next to the automatic door for when it fails to operate automatically.
(4) Manual opening button for indoor automatic doors: Must be installed in an easily operable location at a height of 0.8 m to 1.5 m from the floor.
Key point: Door width must be at least 80 cm, and devices to prevent body/hand entrapment are required.""",
        metadata={"source": SOURCE_LAW, "article": "Article 8", "title": "Interior Doors", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 9 (Interior Room Partitions)
(1) When installing fixed partitions inside living rooms: Effective corridor width (excluding apartments and officetels) must be 120 cm or more for evacuation. If partition material is glass, safety glass must be used.
(2) Passageways from partitioned rooms to entrances: Must be as straight as possible for easy use during emergencies.
(3) Detailed standards when partitioning living rooms with dividers (Article 2, Item 3 buildings):
  1. Maximum 2 sections (upper and lower), height from floor to ceiling must be 1.7 m or less (lower section excluded) — Revised 2026.01.22
  2. Partitions must not be structurally permanent with main structural components (columns, beams), and must be separable/dismantlable
  3. Horizontal area of horizontal partition (from outer wall centerline to partition end) must be within 30% of floor area of that use on that floor (maximum 100 m²)
  4. Partitions must be structurally safe (requires structural safety confirmation from registered architect or structural engineer)
  5. Partitioned space must be in open-space structure with no obstruction to evacuation
  6. Interior finishing materials of partitions must be non-combustible, quasi-non-combustible, or flame-retardant (exception when sprinklers or similar automatic fire suppression equipment is installed)
  7. Protruding parts of partitioned space must use cushioning materials or have corners rounded to prevent collision/entrapment accidents
  8. Stairs and ramps: Apply anti-slip measures and identification markings per Article 5, Items 1, 4, and 5
  9. Safety railings in partitioned spaces: Apply Article 6 (railing height may be relaxed to at least 1/2 of height from partitioned floor to ceiling)""",
        metadata={"source": SOURCE_LAW, "article": "Article 9", "title": "Interior Room Partitions", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 10 (Mechanical Piping)
(1) When embedding water supply/drainage pipes in concrete: Corrosion-prone materials must have anti-corrosion measures. Must comply with Article 17 of the Building Equipment Standards Enforcement Rules.
(2) Ventilation facilities: Must comply with ventilation equipment standards under Article 11 of the Building Equipment Standards Enforcement Rules.
(3) Gas piping: Must comply with piping and piping equipment standards in Attached Table 7 of Article 17(7) of the Urban Gas Business Act Enforcement Rules (Facility, Technical, and Inspection Standards for Gas-Using Facilities).
Key point: Pipes must be treated with corrosion prevention, and gas pipes must follow separate legal standards.""",
        metadata={"source": SOURCE_LAW, "article": "Article 10", "title": "Mechanical Piping", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 11 (Evacuation and Guidance Facilities)
When installing alarms, evacuation, and guidance equipment necessary for evacuation indoors, they must comply with the following laws:
  - Act on Fire Prevention and Installation, Maintenance, and Safety Management of Fire-Fighting Systems
  - Article 2(1) of the Enforcement Rules of the Act on Guarantee of Promotion of Convenience of Persons with Disabilities, the Elderly, Pregnant Women, etc.
Key point: Fire alarms, emergency exit guide lights, and accessibility facilities for people with disabilities must comply with related legal standards.""",
        metadata={"source": SOURCE_LAW, "article": "Article 11", "title": "Evacuation and Guidance Facilities", "category": "interior_law_en"},
    ),
    Document(
        page_content="""\
Article 12 (Review Period)
The Minister of Land, Infrastructure and Transport shall review the validity of this notice every 3 years from January 1, 2017 (by the same date as the base date of every 3rd year) and take improvement measures as necessary, pursuant to the Regulations on Issuance and Management of Instructions and Directives.
Key point: These standards are periodically reviewed and revised every 3 years.""",
        metadata={"source": SOURCE_LAW, "article": "Article 12", "title": "Review Period", "category": "interior_law_en"},
    ),
]


def ingest_collection(
    chunks: list[Document],
    collection_name: str,
    embeddings: GoogleGenerativeAIEmbeddings,
) -> None:
    """주어진 청크를 지정 컬렉션 이름으로 ChromaDB에 적재합니다."""
    # 기존 컬렉션 초기화 (중복 방지)
    try:
        existing = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=DB_DIR,
        )
        existing.delete_collection()
        print(f"  기존 '{collection_name}' 컬렉션 삭제 완료")
    except Exception:
        pass

    Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_DIR,
        collection_name=collection_name,
    )
    print(f"  '{collection_name}' 컬렉션 적재 완료 ({len(chunks)}개 청크)")


def main() -> None:
    print("🔧 Google Gemini 임베딩 모델 초기화 중...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

    print("\n📦 영어 데이터를 ChromaDB에 적재합니다...")
    ingest_collection(CHECKLIST_CHUNKS_EN, "interior_checklist_en", embeddings)
    ingest_collection(LAW_CHUNKS_EN, "interior_law_standard_en", embeddings)

    print("\n" + "=" * 50)
    print("✅ 영어 데이터 적재 완료!")
    print(f"   - interior_checklist_en   : {len(CHECKLIST_CHUNKS_EN)}개")
    print(f"   - interior_law_standard_en: {len(LAW_CHUNKS_EN)}개")

    # ── 검증: 영어 질문으로 검색 테스트
    print("\n" + "=" * 50)
    print("🔍 벡터 검색 검증 테스트")
    print("=" * 50)

    law_db = Chroma(
        collection_name="interior_law_standard_en",
        embedding_function=embeddings,
        persist_directory=DB_DIR,
    )
    checklist_db = Chroma(
        collection_name="interior_checklist_en",
        embedding_function=embeddings,
        persist_directory=DB_DIR,
    )

    tests = [
        (law_db,       "What are the slip resistance requirements for bathroom tile floors?", "article"),
        (law_db,       "What is the minimum height for safety railings on open staircases?",  "article"),
        (checklist_db, "What should I check after bathroom tiling is complete?",              "process"),
    ]
    for db, query, key in tests:
        results = db.similarity_search(query, k=1)
        print(f"\n[Query] {query}")
        print(f"  → {results[0].metadata[key]}: {results[0].metadata['title']}")

    print("\n✅ 검증 완료")


if __name__ == "__main__":
    main()
