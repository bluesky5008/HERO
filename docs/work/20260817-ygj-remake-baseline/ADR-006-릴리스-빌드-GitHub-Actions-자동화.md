# ADR-006: 릴리스 빌드 GitHub Actions 자동화

> 문서 유형: `adr`
> 작업 ID: `20260817-ygj-remake-baseline`
> 상태: `approved`
> 기준선: `N/A — 기준선은 요구사항·설계 문서가 보유`
> 작성일: 2026-08-17
> 최종 갱신: 2026-08-17
> 관련 문서: [REQ-ygj-remake: 요구사항 명세](../../requirements.md), [DESIGN-ygj-remake: SW 설계](../../design.md)

## 요약

- 결정: 릴리스 빌드는 `v*` 태그 푸시로 트리거되는 GitHub Actions 매트릭스(windows-latest·macos-latest)를 표준 경로로 하고, validate+테스트 통과를 빌드 게이트로 두며, 서명은 하지 않는다. 로컬 수동 빌드는 디버깅·실기 검증용 보조 수단이다.
- 핵심 이유: 두 OS 수동 빌드 반복 제거, 빌드 재현성, 버전 태그와 산출물의 1:1 대응.
- 주요 단점: 무서명 산출물은 맥에서 Gatekeeper 우회 절차가 필요하다.

## 문서 연결

| 방향 | 관계 | 대상 문서 | 대상 항목 | 비고 |
|---|---|---|---|---|
| bidirectional | decision | [REQ-ygj-remake: 요구사항 명세](../../requirements.md) | FR-21, AC-11, NFR-07 | 빌드 자동화 요구의 근거 결정 |
| bidirectional | decision | [DESIGN-ygj-remake: SW 설계](../../design.md) | DES-14 | 빌드 파이프라인 설계의 전제 |

## 배경

윈도우·맥 실기를 모두 보유하고 있어 로컬 빌드도 가능하지만, 릴리스마다 두 OS에서 수동 빌드를 반복하는 비용과 환경 오염에 따른 재현성 문제가 있다. 선행 명세 [상세 스펙 §12](../../../yeonggeoljeon-remake-spec-detail.md)의 확정 방침을 ADR로 기록한다.

## 영향을 받는 요구사항과 제약

- [FR-21](../../requirements.md) 빌드 자동화, [FR-20](../../requirements.md) 패키징, [AC-11](../../requirements.md), [NFR-07](../../requirements.md)(비공개 리포·자료 제외).
- 제약: 프라이빗 리포의 무료 Actions 분수 한도(맥 러너 소모 배수 10배) — 태그 릴리스만 빌드.

## 고려한 대안

| 대안 | 장점 | 단점·위험 | 전환 비용 |
|---|---|---|---|
| 로컬 수동 빌드 표준 | CI 설정 불필요 | 릴리스마다 양 OS 반복 작업, 환경 재현성 없음, 태그·산출물 대응 관리 수동 | 낮음(보조 수단으로 유지) |
| 매 커밋 CI 빌드 | 조기 회귀 발견 | 맥 러너 분수 낭비(10배), 개인 프로젝트에 과함 | 중간 |
| 태그 트리거 릴리스 빌드+경량 검증 CI (선택) | 분수 절약, 재현성, 태그:산출물 1:1 | 커밋 단위 빌드 회귀는 늦게 발견(로컬 dev로 보완) | — |

## 결정

- `.github/workflows/release.yml`: `v*` 태그 푸시+`workflow_dispatch` 트리거. 매트릭스 — windows-latest(NSIS 설치본+포터블), macos-latest(유니버설 `.dmg`).
- 각 잡: checkout → Node/Rust 셋업(캐시) → `npm ci` → `npm run validate && npm test`(실패 시 중단) → tauri-action 빌드 → Release 초안 업로드.
- 서명 없음(개인 사용). 맥 Gatekeeper 우회 안내를 Release 노트 템플릿에 자동 포함.
- 선택: PR/푸시용 경량 검증 CI(ubuntu-latest, validate+test만).
- 버전 규칙: `tauri.conf.json`·`package.json`·git 태그 일치, `npm run release:tag` 범프 스크립트.

## 이유

- 태그 푸시 한 번으로 양 OS 산출물이 나오는 것이 M6 완료 기준이며, 수동 반복을 구조적으로 제거한다.
- 리눅스 러너 검증 CI는 저렴하고 로직 테스트는 OS 무관이라 비용 대비 효과가 좋다.

## 결과와 감수할 단점

- GitHub 프라이빗 리포 생성이 선행 조건이 된다([Q-01](../../requirements.md#가정과-미해결-질문)).
- 무서명이므로 맥 첫 실행 시 우클릭→열기(또는 `xattr -cr`) 절차를 감수한다.

## 후속 작업

- M6에서 워크플로 작성·태그 릴리스 리허설·양 OS 실기 검증(wf-implement 소유).

## 대체 관계

- 대체 대상 ADR: 없음
- 대체 ADR: 없음

## 승인 기록

- 2026-08-17: **승인** — 결정자: 사용자. 근거: 기준선 v1 승인 관문 응답("승인").

## 변경 이력

| 날짜 | 변경 | 근거 | 상태 또는 기준선 | 작성자·승인자 |
|---|---|---|---|---|
| 2026-08-17 | 선행 명세의 확정 방침을 ADR로 기록 | [상세 스펙 §12](../../../yeonggeoljeon-remake-spec-detail.md) | proposed | Claude(작성) |
| 2026-08-17 | 기준선 v1 승인에 따라 확정 | 대화형 승인 관문 응답("승인") | proposed → approved | 사용자(승인)·Claude(기록) |
