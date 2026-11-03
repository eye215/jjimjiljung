# 찜질중 iOS 앱 준비 (Capacitor 8)

기존 Three.js·Supabase 웹사이트를 **로컬 정적 에셋을 포함하는 iOS 앱**으로 패키징합니다. 단순히 외부 URL을 WebView에 표시하는 방식이 아닙니다. 웹 버전과 데이터 서버는 공유합니다.

## Mac에서 한 번 실행
1. Mac에 **Xcode 26 이상**과 Node.js **22 이상** 설치, Xcode 최초 실행 및 약관 수락
2. 이 저장소를 Mac에 내려받거나 기존 로컬 저장소를 최신 상태로 업데이트
3. 저장소 루트의 터미널에서 실행:

```bash
bash tools/setup-ios.sh
npx cap open ios
```

4. Xcode → **App** 타깃 → **Signing & Capabilities** → Apple Developer Team 선택
5. **Bundle Identifier**(기본 `com.yullul.jjimjiljung`)가 Apple Developer 계정에서 사용 가능한지 확인. 등록되어 있다면 유지하고, 아니라면 등록 또는 변경
6. iPhone에서 실기기 테스트 후 App Store Connect에 앱 등록·TestFlight 업로드

## 웹 콘텐츠 갱신
코드를 수정하고 나서는 다음 명령을 실행합니다.

```bash
node tools/prepare-ios.mjs
npx cap sync ios
```

설치 스크립트 실행 후 만들어지는 `package-lock.json`은 팀에서 같이 관리할 수 있도록 커밋하고, `www/`·`ios/`는 첫 작업 때 빌드 결과와 네이티브 설정을 검토한 뒤 버전 관리 방식을 결정하세요.

## 반드시 확인해야 할 사항
- iOS WebView의 origin은 웹 호스팅 주소와 다릅니다. Supabase Realtime, 인증·스토리지·CORS 및 외부 SDK에 대해 실기기 테스트가 필요합니다.
- 로그인 없이 익명으로 접속한 웹 사용자와 iOS 앱 사용자는 기본적으로 **서로 다른 계정**입니다. 기존 이어하기 기능 또는 계정 연동을 검증하세요.
- 앱스토어 심사 전 Apple의 **개인정보 처리·채팅·신고/차단·콘텐츠 관리** 요구사항을 검토하세요. AI 사주방은 현재 공사 중 상태를 유지합니다.
- 앱 아이콘, 스플래시, 앱스토어 스크린샷, 개인정보 고지, Apple 서명·배포 인증서 준비가 필요합니다.
- 이 파일은 **앱 프로젝트 생성 준비**를 위한 것이며 Xcode 빌드·서명·TestFlight 업로드를 성공했다는 의미가 아닙니다.
