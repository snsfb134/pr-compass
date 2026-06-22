import "./globals.css";

export const metadata = {
  title: "PR Compass",
  description: "캐나다 영주권 전략을 위한 공식 소스 추적, 변경 감지, 해석, 로드맵 도구",
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="ko">
      <body className="bg-[var(--page-bg)] text-[var(--page-ink)] antialiased">{children}</body>
    </html>
  );
}
