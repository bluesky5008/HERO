# DESIGN-ygj-remake: 삼국지 영걸전 리메이크 SW 설계

> 문서 유형: `design`
> 작업 ID: `20260817-ygj-remake-baseline`
> 상태: `approved`
> 기준선: `v1` (승인일 2026-08-17)
> 작성일: 2026-08-17
> 최종 갱신: 2026-08-17
> 관련 문서: [REQ-ygj-remake: 요구사항 명세](./requirements.md), [전체 설계 문서 v1.1](../yeonggeoljeon-remake-design.md), [상세 스펙 문서 v1.1](../yeonggeoljeon-remake-spec-detail.md)

## 요약

- 목적: [REQ-ygj-remake](./requirements.md)를 만족하는 시스템 구조·데이터 계약·동작·검증 전략을 확정한다.
- 현재 결론 또는 상태: 순수 로직 코어 / PixiJS 렌더 / DOM UI 3층 구조와 데이터 주도 계약으로 설계 요소 14건(DES-01~14)을 확정했다. 상세 규칙·수치·스키마는 선행 명세 2종을 정본 상세로 포함한다. 2026-08-17 사용자 승인으로 기준선 v1 발행.
- 다음 행동: wf-implement(M0 뼈대) 계획 수립부터 구현을 진행한다.

## 문서 연결

| 방향 | 관계 | 대상 문서 | 대상 항목 | 비고 |
|---|---|---|---|---|
| input | baseline | [REQ-ygj-remake: 요구사항 명세](./requirements.md) | FR-01~21, NFR-01~08, AC-01~12 | 이 설계의 입력 기준선 |
| input | refinement | [전체 설계 문서 v1.1](../yeonggeoljeon-remake-design.md) | document | 사용자 작성 선행 명세. 원본 보존을 위해 역방향 링크 없음(단방향 허용 사유) |
| input | refinement | [상세 스펙 문서 v1.1](../yeonggeoljeon-remake-spec-detail.md) | document | 정본 상세 스펙(규칙·수치·스키마·DSL). 충돌 시 전체 설계보다 우선. 단방향 사유 동일 |
| bidirectional | decision | [ADR-001: 하이브리드 리메이크와 데이터 주도 엔진](./work/20260817-ygj-remake-baseline/ADR-001-하이브리드-리메이크와-데이터-주도-엔진.md) | DES-03, DES-12 | |
| bidirectional | decision | [ADR-002: 기술 스택 선정](./work/20260817-ygj-remake-baseline/ADR-002-기술-스택-선정.md) | DES-05, DES-06, DES-08, DES-14 | |
| bidirectional | decision | [ADR-003: 결정론적 RNG와 세이브 포함 정책](./work/20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md) | DES-04, DES-08 | |
| bidirectional | decision | [ADR-004: 원작 맵 동일 재현과 트레이싱 도구 선행](./work/20260817-ygj-remake-baseline/ADR-004-원작-맵-동일-재현과-트레이싱-도구-선행.md) | DES-11, DES-12 | |
| bidirectional | decision | [ADR-005: 장수 에디터 오버레이 전역 적용](./work/20260817-ygj-remake-baseline/ADR-005-장수-에디터-오버레이-전역-적용.md) | DES-02, DES-03, DES-09 | |
| bidirectional | decision | [ADR-006: 릴리스 빌드 GitHub Actions 자동화](./work/20260817-ygj-remake-baseline/ADR-006-릴리스-빌드-GitHub-Actions-자동화.md) | DES-14 | |
| output | implementation | [PLAN-ygj-remake: 구현 계획](./plan.md) | TASK-01~09 (M0) | 이 설계를 구현하는 계획 |
| related | related | [결정 등록부](./decisions.md) | document | ADR 전체 목록 |

## 설계 목표와 제약

[전체 설계 §1.3](../yeonggeoljeon-remake-design.md)의 5원칙을 설계 제약으로 채택한다.

1. **데이터 주도**: 모든 게임 콘텐츠는 `data/` JSON에 존재하고 엔진은 해석기다.
2. **스키마 검증**: 모든 데이터 파일은 zod로 검증하고 참조 무결성을 실행 전에 전수 검사한다.
3. **결정론적 로직**: 전투 계산은 시드 기반 난수로 동일 입력→동일 결과를 보장한다.
4. **로직·렌더링 분리**: 전투 규칙은 렌더링 없이 단독 실행 가능한 순수 TypeScript 모듈이다.
5. **원작 우선, 개조 허용**: 기본값은 원작 재현이며 모든 수치는 데이터 파일에서 개조 가능하다.

추가 제약: 개인 플레이 전용(네트워크·서버·배포 없음), 선행 명세 충돌 시 상세 스펙 우선, 마일스톤 로드맵([전체 설계 §8](../yeonggeoljeon-remake-design.md))은 wf-implement 계획의 입력이다.

## 시스템 경계와 구조

- **경계**: 로컬 단일 사용자 애플리케이션. 외부 연동은 파일 시스템(세이브·사용자 초상화)과 GitHub Actions(릴리스 빌드)뿐이다. 인증·개인정보·네트워크 통신 없음.
- **실행 형태**: 개발 중 브라우저(`npm run dev`, Vite), 완성 시 Tauri v2 데스크톱 앱(윈도우 exe·맥 .app). 저장소·에셋 접근은 인터페이스로 추상화해 두 환경을 같은 코드로 지원한다.

```text
data/*.json ──(zod 검증·사용자 오버레이 병합: DES-03)──▶ core (순수 TS: DES-01,02,04)
                                                          │  BattleEvent 큐 / Zustand 스토어
                                        ┌─────────────────┴─────────────────┐
                                   render (PixiJS: DES-05)            ui (DOM/CSS: DES-06)
                                        └─────────────────┬─────────────────┘
                                                     scenes (DES-07)
                                    save (DES-08) · assets (DES-09) · audio (DES-10)
     tools/map-editor (DES-11, 개발 도구) · .github/workflows (DES-14, 빌드)
```

폴더 구조는 [전체 설계 §6.1](../yeonggeoljeon-remake-design.md)을 그대로 채택한다(`src/core`·`src/render`·`src/ui`·`src/scenes`·`src/audio`·`src/save`·`data/`·`tools/`·`scripts/`·`tests/`·`src-tauri/`).

## 컴포넌트와 책임

| ID | 항목 | 내용 |
|---|---|---|
| DES-01 | 전투 코어 (`src/core/battle`) | 턴·페이즈 관리, 이동 범위 산출(BFS/다익스트라), 물리·책략 데미지, 사기·혼란, 경험치·레벨·승급, 적 AI(프로필+스코어링). 모든 행동은 `applyCommand(state, cmd, rng) → BattleEvent[]` 커맨드로 표현한다. 규칙·수치 정본: [상세 스펙 §1, §5](../yeonggeoljeon-remake-spec-detail.md) (→ FR-02~08, FR-11, NFR-04) |
| DES-02 | 캠페인 코어 (`src/core/campaign`) | `CampaignState` 관리, 분기 판정(플래그+스테이지 결과), 이벤트 러너(DSL 인터프리터), 엔딩 판정, `officerEditor` 순수 함수(검증→적용→파생치 재계산). 정본: [상세 스펙 §3, §4, §11](../yeonggeoljeon-remake-spec-detail.md) (→ FR-01, FR-09, FR-10, FR-16) |
| DES-03 | 데이터 계층 (`src/core/data`) | JSON 로더, zod 스키마(코드가 스키마 정본), 사용자 오버레이 필드 단위 병합(`officers-user.json`·`portraits-user.json` 우선), 참조 무결성 검사(validate 스크립트와 공유). 정본: [상세 스펙 §9](../yeonggeoljeon-remake-spec-detail.md) (→ FR-13, FR-16, NFR-03) |
| DES-04 | RNG (`src/core/rng.ts`) | xoshiro128** 시드 기반 난수. 128bit 상태 직렬화/복원 API, 전투 시드 = 캠페인 시드+스테이지 ID+진입 횟수. [ADR-003](./work/20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md) (→ FR-12, NFR-01) |
| DES-05 | 렌더 계층 (`src/render`) | TilemapRenderer·UnitRenderer(`animations.json`을 읽는 범용 애니메이션 상태 기계 1개)·EffectRenderer·CameraController. 레이어 순서 지형→하이라이트→유닛→이펙트→커서. 스프라이트 누락 시 플레이스홀더 렌더, 진영 구분은 팔레트 틴트 (→ FR-17, FR-18, NFR-03) |
| DES-06 | UI 계층 (`src/ui`) | PixiJS 캔버스 위 DOM 오버레이(메뉴·상태창·대화창·상점·편성·에디터). Zustand 스토어로 게임 상태와 단방향 동기화. 병과명·상성 등 전 표시는 데이터 파일을 읽어 렌더링(하드코딩 금지) (→ FR-18) |
| DES-07 | 씬 관리 (`src/scenes`) | Title/Campaign/Battle/Ending 씬 전환과 수명 주기 (→ FR-01) |
| DES-08 | 저장 계층 (`src/save`) | `SaveStore { list/read/write/delete }` 추상화, 구현체 `LocalStorageStore`(개발)·`TauriFsStore`(패키징). 슬롯: 수동 8+자동 롤링 3+pre-battle 1. 원자적 쓰기, `version` 마이그레이션 체인, `dataHash` 검사와 참조 폴백. 포맷 정본: [상세 스펙 §2](../yeonggeoljeon-remake-spec-detail.md) (→ FR-12, FR-20, NFR-05) |
| DES-09 | 에셋 저장 (`AssetStore`) | 사용자 업로드 초상화의 저장 추상화(개발: IndexedDB / 패키징: `appDataDir()/user-portraits`). 업로드→중앙 크롭+표준 크기 리사이즈 파이프라인. [상세 스펙 §11.4](../yeonggeoljeon-remake-spec-detail.md) (→ FR-16) |
| DES-10 | 오디오 (`src/audio`) | Howler.js 래퍼. BGM 루프·효과음 재생, 이벤트 액션(`playBgm`/`playSfx`) 연동, 맥 WKWebView 자동재생 정책 대응 (→ FR-19, NFR-08) |
| DES-11 | 맵 트레이싱 도구 (`tools/map-editor`) | 인브라우저 에디터: 참조 이미지 오버레이(투명도·배율·오프셋·이어붙이기), 타일 팔레트 페인팅(채우기·영역), 유닛/오브젝트 배치, 원작 대조 토글, `unverified` 마킹, `stages/*.json` 직접 입출력. [상세 스펙 §6.2](../yeonggeoljeon-remake-spec-detail.md) (→ FR-14, FR-15) |
| DES-12 | 데이터 계약 (`data/`) | `config/`(combat·game)·`classes`·`affinity`·`officers`·`tactics`·`items`·`terrain`·`scenario/`(campaign·stages·dialogues)·`assets-map/`(sprites·animations·portraits) 파일 구조와 스키마. 구조 정본: [전체 설계 §4](../yeonggeoljeon-remake-design.md), 스키마 정본: [상세 스펙 §9](../yeonggeoljeon-remake-spec-detail.md) (→ FR-03, FR-04, FR-07, FR-13, FR-14, NFR-06) |
| DES-13 | 이벤트 DSL 계약 | 트리거 9종·액션 20종(`setAiProfile` 포함)·조건·`once` 규칙과 실행 시점(커맨드 적용 직후+턴 경계, 배열 순서). 정본: [상세 스펙 §3](../yeonggeoljeon-remake-spec-detail.md) (→ FR-08, FR-09, FR-10) |
| DES-14 | 빌드 파이프라인 (`.github/workflows`) | `release.yml`: `v*` 태그 트리거, 윈도우(NSIS+포터블)·맥(유니버설 .dmg) 매트릭스, validate+테스트 게이트, Release 초안 업로드, 무서명(Gatekeeper 안내 자동 포함). 선택: PR용 경량 검증 CI(ubuntu). 버전 범프 `npm run release:tag`. [상세 스펙 §12](../yeonggeoljeon-remake-spec-detail.md) (→ FR-20, FR-21, NFR-07, NFR-08) |

## 데이터와 인터페이스

- **코어 계약** ([전체 설계 §6.3](../yeonggeoljeon-remake-design.md)): `BattleState`(units·turn·phase·weather·flags), `Unit`, `Command = Move | Attack | UseTactic | UseItem | Wait`, `applyCommand(state, cmd, rng): BattleEvent[]`. 렌더러·UI는 BattleEvent 큐를 구독해 연출만 재생한다(스킵 지원).
- **데이터 계약**: DES-12의 파일별 스키마. zod 스키마 코드(`src/core/data/schemas.ts`)가 정본이며 [상세 스펙 §9](../yeonggeoljeon-remake-spec-detail.md)의 발췌를 그대로 옮겨 시작한다.
- **세이브 포맷 v1** ([상세 스펙 §2.3](../yeonggeoljeon-remake-spec-detail.md)): `version`·`dataHash`·`type(worldmap|battle|auto)`·`savedAt`·`label`·`campaign`·`battle{units, firedEvents, treasuresTaken, rng}`. 사용자 오버레이는 `dataHash` 계산에서 제외한다([ADR-005](./work/20260817-ygj-remake-baseline/ADR-005-장수-에디터-오버레이-전역-적용.md)).
- **오버레이 계약**: `officers-user.json`·`portraits-user.json`을 기본 데이터 위에 필드 단위 병합(오버레이 우선). 레벨은 현재 캠페인 즉시 반영+`joinLevel` 갱신의 2갈래 적용([상세 스펙 §11.2~11.3](../yeonggeoljeon-remake-spec-detail.md)).
- **입력 검증과 오류 표현**: 데이터 파일 위반은 실행 전 validate 에러 목록. 세이브·오버레이 로드 시 참조 무결성 재검사, 실패는 안전 폴백+경고 로그. 에디터 UI 입력은 UI와 저장 시 이중 검증.
- **버전·호환성**: 세이브 `version` 마이그레이션 함수 체인(불가 시 명확한 에러), `dataHash` 불일치는 경고 후 로드 허용(개조 전제 프로젝트).

## 정상·실패·복구 흐름

- **정상(전투)**: 입력 → `Command` 생성 → `applyCommand` 상태 전이 → `BattleEvent` 연출 재생 → 이벤트 트리거 평가(커맨드 직후+턴 경계) → 페이즈 교대. 턴 시작 처리 순서는 자동 저장→거점 회복→자연 회복→상태이상 판정→턴 이벤트([상세 스펙 §1.1](../yeonggeoljeon-remake-spec-detail.md)).
- **정상(세이브/로드)**: 저장은 커맨드 적용이 완결된 일관 상태에서만 허용(플레이어 페이즈 입력 대기 중). 연출·이벤트·적 턴 중 수동 저장 불가. 로드는 캠페인+전투 스냅숏+RNG 상태를 복원하고 `rngOnLoad` 설정을 적용.
- **실패와 복구**:
  - 데이터 스키마·참조 오류 → 기동 전 에러 목록으로 차단(AC-01).
  - 스프라이트·초상 누락 → 플레이스홀더 렌더로 계속 실행+경고(NFR-03).
  - 세이브 버전 불일치 → 마이그레이션 체인, 불가 시 명확한 에러. 손상 방지는 원자적 쓰기.
  - 개조 후 구세이브의 삭제된 ID → 병과는 계열 1티어로, 아이템은 제거로 폴백+로그(NFR-05).
  - 크래시·실수 → 턴 시작 자동 저장 롤링 3개와 pre-battle 슬롯으로 복구.
- **동시성·일관성**: 단일 스레드 게임 루프. 저장 지점이 커맨드 경계로 한정되므로 직렬화 시점의 상태는 항상 일관된다.

## 보안과 품질 속성

- 인증·개인정보·네트워크 없음(로컬 개인 앱). 비밀 정보를 데이터·세이브에 두지 않는다.
- 사용자 업로드 이미지는 로컬(AssetStore)에만 저장하고 표준 크기로 리사이즈한다. 외부 전송 없음.
- 성능: 적 페이즈 AI 전탐색 100ms 이내(NFR-04, 부대당 이동 범위×타깃 전탐색으로 충분 — [상세 스펙 §5.2](../yeonggeoljeon-remake-spec-detail.md)), 1280×720 정수 스케일링.
- 유지보수성: 데이터 주도+스프라이트 계약+MODDING.md로 개조 비용 최소화. 관측성은 validate 리포트와 폴백 경고 로그.
- 저작권: 원작 추출물 미사용, `reference/` git 제외, 비공개 리포, 비배포(NFR-07).

## 마이그레이션과 롤백

- 세이브: 원자적 쓰기(임시 파일→rename), `version` 체인 마이그레이션, `dataHash` 경고. 개발(localStorage)→패키징(Tauri fs) 전환은 `SaveStore` 구현체 교체로 수행.
- 장수 에디터: 오버레이 파일 삭제("전체 초기화" 버튼)만으로 원작 값 복원. 기본 데이터 파일은 불변.
- 데이터 개조 롤백: 데이터가 전부 JSON 파일이므로 git 리버트로 충분.
- 기존 시스템 마이그레이션: N/A — 신규 프로젝트로 기존 사용자·데이터 없음.

## 검증 전략

| 층 | 방법 | 대응 인수 조건 |
|---|---|---|
| 정적 | `npm run validate`: 참조 무결성 전수, 4대 애니메이션 계약, affinity 행렬 커버, 캠페인 그래프 도달성·순환, `unverified` 리포트 | AC-01, AC-10 |
| 단위(Vitest, `core/` 대상) | 데미지·상성·지형·아이템 보정, 이동 범위, 책략 게이트 전 조합, 경험치·승급, 이벤트 러너, 분기 판정, 세이브 라운드트립(속성 기반 100회), 에디터 규칙([상세 스펙 §10.1, §11.6](../yeonggeoljeon-remake-spec-detail.md)) | AC-04, AC-06, AC-09(일부), AC-12 |
| 통합·수동 | 마일스톤 완료 기준 플레이 검증, 전투 중 저장→강제 종료→재개 시나리오, 스테이지 검수 체크리스트([상세 스펙 §6.3](../yeonggeoljeon-remake-spec-detail.md)), M2 원작 실측 대조 튜닝 세션, M6 양 OS 실기 검증 | AC-02, AC-03, AC-05, AC-07, AC-08, AC-09, AC-11 |

구체적인 테스트 케이스 선정과 실행·증거 기록은 wf-implement가 소유한다. TDD 규정(실패하는 테스트 먼저)은 wf-implement §3.3을 따른다.

## 대안과 결정

| 결정 | ADR | 상태 |
|---|---|---|
| 하이브리드 리메이크(엔진 신규+데이터 JSON, 원작 파일 미사용)와 데이터 주도 아키텍처 | [ADR-001](./work/20260817-ygj-remake-baseline/ADR-001-하이브리드-리메이크와-데이터-주도-엔진.md) | approved |
| 기술 스택: TS·Vite·PixiJS v8·DOM UI·Zustand·zod·Vitest·Tauri v2·Howler.js | [ADR-002](./work/20260817-ygj-remake-baseline/ADR-002-기술-스택-선정.md) | approved |
| 결정론적 RNG(xoshiro128**)+세이브에 RNG 상태 포함+`rngOnLoad` 옵션(기본 reseed) | [ADR-003](./work/20260817-ygj-remake-baseline/ADR-003-결정론적-RNG와-세이브-포함-정책.md) | approved |
| 원작 맵 타일 단위 동일 재현(간략화 금지)+트레이싱 도구 선행(도구 완성 전 맵 입력 금지) | [ADR-004](./work/20260817-ygj-remake-baseline/ADR-004-원작-맵-동일-재현과-트레이싱-도구-선행.md) | approved |
| 장수 에디터는 사용자 오버레이 파일로 전역 적용(기본 데이터 불변, dataHash 제외) | [ADR-005](./work/20260817-ygj-remake-baseline/ADR-005-장수-에디터-오버레이-전역-적용.md) | approved |
| 릴리스 빌드는 GitHub Actions 태그 트리거 매트릭스로 자동화(무서명) | [ADR-006](./work/20260817-ygj-remake-baseline/ADR-006-릴리스-빌드-GitHub-Actions-자동화.md) | approved |

## 가정과 미해결 질문

- [REQ-ygj-remake 가정과 미해결 질문](./requirements.md#가정과-미해결-질문)을 공유한다(`[검증]` 초기값 튜닝 전제, Node 환경, Q-01 git 시점).
- 설계 선택 사항(범위 내, 우선순위 낮음): 로드 화면 스크린샷 썸네일, 미니맵, 인게임 데이터 뷰어, Tiled TMX 가져오기 — 구현 여부는 wf-implement 계획에서 결정하되 미구현이어도 인수 조건에 영향 없다.

## 위험

- [REQ-ygj-remake 위험](./requirements.md#위험)(RISK-01~06)을 그대로 승계한다.

| ID | 위험 | 영향 | 완화 |
|---|---|---|---|
| RISK-07 | PixiJS v8·Tauri v2 등 의존성 API 변화 | 빌드 파손 | 버전 고정(lockfile), 업그레이드는 별도 작업으로 분리 |
| RISK-08 | 맥 WKWebView 오디오 정책·키 입력 차이 | 맥 실기 동작 불량 | M6 실기 검증 체크리스트에 포함(NFR-08), 첫 입력 후 오디오 재생 등 표준 대응 |

## 추적성

- 요구사항→설계→인수 조건 전체 매핑은 [REQ-ygj-remake 추적성](./requirements.md#추적성)이 정본이다. 각 DES 항목의 대응 FR/NFR은 [컴포넌트와 책임](#컴포넌트와-책임) 표의 괄호 표기와 일치한다.
- 작업(TASK)·검증(VER) 연결은 wf-implement 계획 수립 시 추가한다.

## 승인 기록

- 2026-08-17: 대화형 승인 요청 발신([REQ-ygj-remake](./requirements.md)와 동일 관문).
- 2026-08-17: **승인** — 결정자: 사용자. 근거: 대화형 승인 관문 응답("승인"). 효력: [REQ-ygj-remake](./requirements.md)와 본 문서, ADR-001~006([결정 등록부](./decisions.md))을 구현 기준선 **v1**으로 확정. wf-implement 시작 조건 충족.

## 변경 이력

| 날짜 | 변경 | 근거 | 상태 또는 기준선 | 작성자·승인자 |
|---|---|---|---|---|
| 2026-08-17 | 선행 명세 2종(v1.1)을 근거로 최초 작성, ADR-001~006 분리 | 사용자 요청(선행 명세 기반 wf-design 진행) | draft → awaiting-approval | Claude(작성) |
| 2026-08-17 | 사용자 승인, 기준선 v1 발행 | 대화형 승인 관문 응답("승인") | awaiting-approval → approved (v1) | 사용자(승인)·Claude(기록) |

## 인계

- 다음 단계 또는 워크플로우: wf-implement — [PLAN-ygj-remake](./plan.md)에서 진행 중이다(M0 완료, M1 예정)
- 시작 조건: 충족 — 기준선 v1 승인 완료(2026-08-17)
- 입력 문서와 기준선: [REQ-ygj-remake](./requirements.md), 본 문서, [결정 등록부](./decisions.md)의 ADR-001~006, 선행 명세 2종([전체 설계](../yeonggeoljeon-remake-design.md)·[상세 스펙](../yeonggeoljeon-remake-spec-detail.md))
- 완료된 항목: 요구사항 명세(FR 21·NFR 8·AC 12), SW 설계(DES 14), ADR 6건, 결정 등록부, 추적 연결
- 미완료 항목: 구현 M1~M6 (M0는 [완료](./work/20260817-m0-skeleton/work-log.md))
- 차단 요인: 없음
- 다음 행동: M1(전투 프로토타입) 사이클 계획 수립
