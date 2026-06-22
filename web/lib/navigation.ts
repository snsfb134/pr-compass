export type NavItem = {
  label: string;
  href: string;
};

export const MAIN_NAV_ITEMS: NavItem[] = [
  { label: "대시보드", href: "/" },
  { label: "프로그램 분석", href: "/program-analysis" },
  { label: "프로필 관리", href: "/profile-management" },
  { label: "근거 자료", href: "/evidence" },
  { label: "변경 이력", href: "/change-history" },
  { label: "설정/알림", href: "/settings" },
];

export const TOOL_NAV_ITEMS: NavItem[] = [
  { label: "막힘 요소", href: "/blockers" },
  { label: "모바일 미리보기", href: "/mobile-preview" },
  { label: "QA 허브", href: "/qa" },
];

export function buildNavItems(activeHref: string, items: NavItem[] = MAIN_NAV_ITEMS) {
  return items.map((item) => ({ ...item, active: item.href === activeHref }));
}
