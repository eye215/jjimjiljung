# 아이폰으로 iOS 클라우드 빌드 실행하기

GitHub 저장소에 **수동 실행 전용** iOS 시뮬레이터 빌드 워크플로가 있습니다.

1. 아이폰 Safari에서 [Actions](https://github.com/eye215/jjimjiljung/actions) 접속
2. 왼쪽 목록에서 **iOS simulator build (manual)** 선택
3. **Run workflow** → **Run workflow** 다시 누르기
4. 작업이 끝나면 초록 체크 또는 빨간 오류 아이콘으로 결과 확인
5. 성공했다면 해당 실행 페이지 아래 **Artifacts → jjimjiljung-ios-simulator** 확인

**꼭 알아둘 것**

- GitHub의 macOS 호스팅 러너는 무료 할당량을 사용할 수 있으나, 한도나 저장소 설정에 따라 비용이 생길 수 있습니다. GitHub Billing/Usage를 확인하세요.
- 산출물은 **서명되지 않은 iOS 시뮬레이터용 .app 압축 파일**입니다. 아이폰에 설치하는 파일(IPA)이 아닙니다.
- 실제 아이폰 설치와 TestFlight/App Store 출시는 Apple Developer 계정의 서명용 인증서·프로비저닝 프로파일이 필요합니다.
- 이 워크플로는 Apple 계정 비밀키를 요구하거나 업로드하지 않습니다.
- 성공한 뒤 다음 단계로 **서명·TestFlight 자동 업로드 워크플로**를 추가할 수 있지만, 인증서 및 App Store Connect API Key 설정이 먼저 필요합니다.
