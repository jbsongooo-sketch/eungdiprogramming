# 모터로그 — 자동차 정비 주기 알림

Supabase Auth와 PostgreSQL로 자동차와 정비 일정을 관리하는 반응형 정적 웹앱입니다. 사용자별 데이터는 RLS로 보호합니다.

## 구성 파일

- `index.html`, `style.css`, `script.js`: 웹 화면과 앱 동작
- `supabase.sql`: 테이블, 관계, 인덱스, 트리거, RLS
- `.env.example`: 설정 변수 이름 참고
- `config.js.example`: 로컬 브라우저 설정 예시
- `build.js`, `package.json`, `vercel.json`: 양쪽 배포 플랫폼용 빌드 설정
- `.github/workflows/deploy.yml`: GitHub Pages 자동 배포

## Supabase 프로젝트 설정

1. [Supabase](https://supabase.com/)에서 프로젝트를 만들고 Auth에서 이메일 로그인을 활성화합니다.
2. **SQL Editor**에서 `supabase.sql`을 전체 실행합니다. 이 스크립트는 Auth 사용자 프로필, 차량 및 정비 기록 테이블과 인덱스, RLS 정책을 만듭니다. 복합 외래 키로 정비 기록이 같은 사용자의 차량만 가리키게 검증합니다.
3. **Settings → API**에서 Project URL과 publishable key(또는 기존 프로젝트의 anon key)를 확인합니다.
4. 로컬 실행 시 `config.js.example`을 `config.js`로 복사하고 두 값을 채웁니다. `config.js`는 `.gitignore`에 포함되어 Git에 올라가지 않습니다. `.env.example`은 변수 이름을 보여주기 위한 참고 파일입니다. 정적 HTML은 `.env`를 직접 읽지 않습니다.

> `service_role`/secret key와 DB 비밀번호는 웹 브라우저 코드나 GitHub Pages 변수에 넣지 마세요. 이 앱은 공개용 publishable/anon key와 RLS를 사용합니다.

## 로컬 실행

`config.js`를 만든 뒤 Python이 설치된 환경에서 다음을 실행합니다.

```sh
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. 회원가입 후 이메일 확인이 켜져 있으면 인증 메일의 링크를 누르고 로그인합니다. 자동차를 등록하고 정비 항목, 마지막 정비일, 사용자 지정 주기를 입력하면 다음 예정일과 남은 날짜가 표시됩니다. 정비 이력 화면에서 검색과 차량/상태 필터, 수정, 삭제를 사용할 수 있습니다. 차량 삭제 시 연결된 정비 기록도 함께 삭제됩니다.

## GitHub 저장소에 업로드

저장소 주소는 `https://github.com/jbsongooo-sketch/study-note-ai`입니다. 로컬 저장소에서 필요한 파일만 커밋하세요. `apps/`, `venproject/`, 기존의 빈 `text.html`, `.env`, `config.js`는 앱 배포에 추가하지 않습니다.

```sh
git add index.html style.css script.js supabase.sql .env.example .gitignore config.js.example README.md package.json build.js vercel.json .github/workflows/deploy.yml
git commit -m "Prepare vehicle maintenance app deployment"
git push -u origin main
```

원격 저장소에 기존 커밋이 있다면 먼저 가져와 병합한 뒤 push하세요. 강제 push로 기존 기록을 덮어쓰지 마세요.

## GitHub Pages 배포

1. 저장소의 **Settings → Pages**에서 Source를 **GitHub Actions**로 설정합니다.
2. **Settings → Secrets and variables → Actions → Variables**에서 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 추가합니다. 둘 다 브라우저에 공개되는 값입니다.
3. `main` 또는 `master` 브랜치에 push하면 `.github/workflows/deploy.yml`이 `index.html`, `style.css`, `script.js`와 생성된 `config.js`를 Pages에 배포합니다. `.env`, `config.js`, 로컬 가상환경은 GitHub에 올라가지 않습니다.
4. GitHub Pages 배포가 성공하면 예상 주소는 `https://jbsongooo-sketch.github.io/study-note-ai/`입니다.

GitHub Free의 Pages는 공개 저장소에서 사용할 수 있습니다. 비공개 저장소는 플랜에 따라 Pages를 지원하지 않을 수 있습니다. [GitHub Pages 설정 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)를 확인하세요.

## Vercel 배포

1. Vercel에서 **Add New → Project**를 선택하고 GitHub 저장소 `jbsongooo-sketch/study-note-ai`를 가져옵니다.
2. 프로젝트 설정에서 Build Command가 `npm run build`, Output Directory가 `dist`인지 확인합니다 (`vercel.json`에 설정되어 있습니다).
3. **Settings → Environment Variables**에 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 등록하고 Production, Preview, Development 환경을 선택합니다.
4. Deploy를 누릅니다. 이후 연결된 브랜치에 push하면 새 빌드가 배포됩니다.

## 배포 후 Supabase Auth 주소 설정

Supabase Dashboard의 **Authentication → URL Configuration**에서 배포한 실제 사이트 주소를 Site URL로 지정하고 Redirect URLs에도 추가합니다. Vercel의 기본 도메인과 GitHub Pages 주소를 모두 사용할 경우 두 주소를 모두 허용 목록에 넣습니다.

정적 사이트에서 URL과 publishable/anon key는 브라우저에 전달됩니다. 권한 경계는 RLS가 담당합니다. `service_role`/secret key나 데이터베이스 비밀번호는 프런트엔드에 절대 넣지 마세요.
