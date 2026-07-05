import "./globals.css";

export const metadata = {
  title: "PR Compass",
  description: "BC PNP와 Express Entry 공식 업데이트를 AI가 한국어로 요약하고 비교하는 PR 브리핑 구독 서비스",
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="ko">
      <body className="bg-[var(--page-bg)] text-[var(--page-ink)] antialiased">{children}</body>
    </html>
  );
}
