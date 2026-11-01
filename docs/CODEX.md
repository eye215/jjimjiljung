# Codex에게 일 맡기는 법 (찜질중)

Codex는 **보조 개발자**입니다. 맡기는 일은 두 가지뿐입니다.

1. **Supabase SQL 실행** (Claude가 만든 `supabase/migrations/*.sql`)
2. **3D 배경 디자인** (조명, 안개, 벽·바닥·가구 색과 재질)

게임 기능·캐릭터·UI는 Claude Code가 합니다. Codex에게는 아래 문구를 그대로 복사해 붙여 넣으세요.

---

## 공통 규칙 (모든 요청 맨 끝에 붙이기)

```
[공통 규칙]
- 저장소: https://github.com/eye215/jjimjiljung
- Supabase는 찜질중 프로젝트(ref: xojeavzrmdizganxjygj)만 사용. StageFlow 프로젝트는 절대 건드리지 말 것.
- service_role 키, secret 키, DB 비밀번호, 액세스 토큰을 저장소·코드·커밋·PR·로그에 남기지 말 것.
- 맡은 범위 밖의 파일은 수정하지 말 것. main에 직접 push하거나 강제 push하지 말 것.
- 오류가 나면 임의로 고치지 말고 오류 문구 전체를 그대로 알려 줄 것.
- 끝나면 결과(성공/실패, 확인한 내용)를 한국어로 짧게 보고할 것.
```

---

## 1. SQL 실행 요청 (템플릿)

`파일이름.sql`과 `한 줄 설명`만 바꿔서 보내세요.

```
저장소 main의 supabase/migrations/파일이름.sql 을 찜질중 프로젝트(xojeavzrmdizganxjygj)에
수정 없이 한 번 실행하고 결과를 알려 주세요.
내용: 한 줄 설명
실행 후 만들어진 테이블·함수·정책 목록과 anon/authenticated 실행 권한을 확인해서 알려 주세요.
게임 코드(*.js, index.html, style.css)는 수정하지 마세요.

[공통 규칙] (위의 공통 규칙 붙여 넣기)
```

### 실행 기록

| 파일 | 내용 | 상태 |
| --- | --- | --- |
| `20261031_groups.sql` | 신청제 그룹 채팅 테이블·RLS·함수 | ✅ 적용 |
| `20261031b_lock_functions.sql` | 채팅 함수 anon 실행 차단 | ✅ 적용 |
| `20261031c_invites.sql` | 초대 링크 일회용 토큰(`create_invite`, `redeem_invite`) | ⏳ 요청 필요 |
| `20261101_transfer.sql` | 다른 기기에서 이어하기 코드(`create_transfer_code`, `claim_transfer_code`) | ⏳ 요청 필요 |

**지금 보낼 것 (두 개 한 번에):**

```
저장소 main의 supabase/migrations/20261031c_invites.sql 과 supabase/migrations/20261101_transfer.sql 을
이 순서대로 찜질중 프로젝트(xojeavzrmdizganxjygj)에 수정 없이 한 번씩 실행하고 결과를 알려 주세요.
- 20261031c_invites.sql: 초대 링크용 일회용 토큰 테이블 invites, 함수 create_invite / redeem_invite
- 20261101_transfer.sql: 다른 기기에서 이어하기용 테이블 transfer_codes, 함수 create_transfer_code / claim_transfer_code
실행 후 두 테이블의 RLS가 켜졌는지, 함수 4개가 anon은 차단·authenticated는 허용인지 확인해서 표로 알려 주세요.
게임 코드(*.js, index.html, style.css)는 수정하지 마세요.

[공통 규칙]
- 저장소: https://github.com/eye215/jjimjiljung
- Supabase는 찜질중 프로젝트(ref: xojeavzrmdizganxjygj)만 사용. StageFlow 프로젝트는 절대 건드리지 말 것.
- service_role 키, secret 키, DB 비밀번호, 액세스 토큰을 저장소·코드·커밋·PR·로그에 남기지 말 것.
- 맡은 범위 밖의 파일은 수정하지 말 것. main에 직접 push하거나 강제 push하지 말 것.
- 오류가 나면 임의로 고치지 말고 오류 문구 전체를 그대로 알려 줄 것.
- 끝나면 결과(성공/실패, 확인한 내용)를 한국어로 짧게 보고할 것.
```

---

## 2. 배경 디자인 요청 (템플릿)

```
[찜질중] 3D 배경 디자인 작업

범위: environment.js 의 재질·색·조명·안개·그림자, 가구 빌더의 모양과 색 (world.js 의 방 위치·문·가구 좌표는 바꾸지 말 것)
대상 공간: 중앙 휴게실, 불가마, 얼음방, 수면실, 소금방, 매점, 입구, 탈의실, 목욕탕, 세신실, 사주방
원하는 느낌: (여기에 원하는 분위기·참고 이미지 설명)

작업 방식
- main에서 새 브랜치(codex/background-이름)를 만들어 작업하고 PR만 올려 주세요. 병합은 하지 마세요.
- 캐릭터(character.js, assets/*.glb), 게임 로직(scene.js, social.js, shop.js 등), UI(index.html, style.css)는 수정하지 마세요.
- 바꾼 모듈이 있으면 index.html과 모든 import의 ?v=rpg-N 숫자를 함께 올려 주세요.
- 외부 CDN·외부 이미지는 쓰지 말고 텍스처는 코드(canvas)로 그려 주세요.
- npm run check 와 npm test 를 돌려 결과를 PR에 적어 주세요.
- 390px 세로 모바일 화면 스크린샷(전·후)을 PR에 붙여 주세요.

[공통 규칙] (위의 공통 규칙 붙여 넣기)
```

Codex가 PR을 올리면 Claude에게 "코덱스 PR 올라왔어"라고만 알려 주세요. Claude가 캐릭터·기능 작업과 충돌하는지 확인하고, 사용자 승인 후 병합합니다.
