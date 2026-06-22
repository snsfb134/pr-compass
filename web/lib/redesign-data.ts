export type Signal = {
  id: string;
  title: string;
  category: string;
  impact: "높음" | "중간" | "낮음";
  changed: string;
  whyItMatters: string;
  personalizedImpact: string;
  recommendedAction: string;
  updatedAt: string;
};

export type ProfileState = {
  readiness: number;
  bestPathway: string;
  scoreGap: string;
  profileStatus: string;
  strongestRoute: string;
  riskSummary: string;
  nextAction: string;
  progress: number;
  roadmapState: Array<{ label: string; status: "done" | "doing" | "todo" }>;
  risks: Array<{ title: string; body: string; severity: "high" | "medium" | "low" }>;
};

export type Scenario = {
  title: string;
  subtitle: string;
  delta: string;
  impact: "긍정" | "보통" | "주의";
  result: string;
  action: string;
};

export const navItems = [
  { label: "홈", href: "/" },
  { label: "대시보드", href: "/app" },
  { label: "신호", href: "/app/signals" },
  { label: "경로", href: "/app/pathways" },
  { label: "시뮬레이터", href: "/app/simulator" },
  { label: "로드맵", href: "/app/roadmap" },
  { label: "알림 설정", href: "/app/notifications" },
  { label: "계정", href: "/app/account" },
] as const;

export const publicSignals: Signal[] = [
  {
    id: "signal-1",
    title: "Express Entry는 여전히 카테고리 신호가 핵심입니다",
    category: "Express Entry · 초청 패턴",
    impact: "높음",
    changed: "일반 CRS 경쟁보다 카테고리별 초청이 전략을 더 크게 좌우하고 있습니다.",
    whyItMatters: "점수 자체가 높아도, 우선 카테고리와 맞아야 실제 이동 속도가 빨라집니다.",
    personalizedImpact: "이 프로필이 프랑스어 또는 캐나다 경력을 더하지 못하면, 일반 EE보다 주정부 경로 의존도가 높아질 수 있습니다.",
    recommendedAction: "순수 CRS 경로와 PNP 보조 경로를 나란히 비교해 보세요.",
    updatedAt: "2026년 6월 12일",
  },
  {
    id: "signal-2",
    title: "프랑스어 능력은 여전히 전략적 레버입니다",
    category: "언어 · 프랑스어 경로",
    impact: "높음",
    changed: "프랑스어 중심의 기회가 여전히 주된 대안 경로로 작동하고 있습니다.",
    whyItMatters: "핵심 CRS가 평범해도, 프랑스어는 두 번째 실행 경로를 열 수 있습니다.",
    personalizedImpact: "프랑스어가 CLB7에 도달하면, 전략은 일반 Express Entry보다 언어 중심 경로로 더 강하게 읽힙니다.",
    recommendedAction: "시뮬레이터에 프랑스어 CLB7 시나리오를 추가하세요.",
    updatedAt: "2026년 6월 11일",
  },
  {
    id: "signal-3",
    title: "BC PNP는 직무-고용주 정합성을 계속 중시합니다",
    category: "BC PNP · 주정부 선발",
    impact: "중간",
    changed: "섹터와 역할 정합성이 넓은 요약 정보보다 더 중요하게 읽히고 있습니다.",
    whyItMatters: "직무와 고용주 지원이 깔끔하면, 연방 경쟁이 높아져도 전략이 흔들리지 않습니다.",
    personalizedImpact: "현재 직함이 TEER 기준과 잘 맞으면, BC PNP가 계속 중심 경로로 읽힐 수 있습니다.",
    recommendedAction: "TEER와 고용주 정보를 먼저 확인하세요.",
    updatedAt: "2026년 6월 10일",
  },
  {
    id: "signal-4",
    title: "캐나다 경력의 비중이 점점 더 커지고 있습니다",
    category: "경력 · CEC 모멘텀",
    impact: "중간",
    changed: "캐나다 경력이 분명한 프로필일수록 여러 경로에서 해석이 쉬워지고 있습니다.",
    whyItMatters: "캐나다 경력은 자격 요건뿐 아니라 전략 신뢰도도 함께 올립니다.",
    personalizedImpact: "캐나다 경력이 1년 더 쌓이면 CEC와 하이브리드 경로가 더 현실적으로 바뀔 수 있습니다.",
    recommendedAction: "다음 12개월 경력 마일스톤을 일정에 고정하세요.",
    updatedAt: "2026년 6월 9일",
  },
];

export const profileState: ProfileState = {
  readiness: 68,
  bestPathway: "BC PNP Tech",
  scoreGap: "영어 + 프랑스어 + 캐나다 경력",
  profileStatus: "프로필 진행 중",
  strongestRoute: "현재는 연방 단독보다 주정부 경로가 더 강합니다",
  riskSummary: "주요 리스크는 타이밍입니다. 언어 또는 직무 증빙이 조금만 늦어도 최적 경로가 바뀔 수 있습니다.",
  nextAction: "프랑스어 CLB7과 1년 캐나다 경력 시나리오를 추가하세요.",
  progress: 57,
  roadmapState: [
    { label: "기본 정보", status: "done" },
    { label: "학력", status: "done" },
    { label: "근무 경력", status: "doing" },
    { label: "언어 점수", status: "todo" },
    { label: "프랑스어", status: "todo" },
    { label: "주정부 적합도", status: "todo" },
  ],
  risks: [
    {
      title: "언어 정체",
      body: "현재 영어 점수만으로는 일반 Express Entry 전략을 충분히 밀어주기 어렵습니다.",
      severity: "high",
    },
    {
      title: "직무 불일치",
      body: "TEER 불일치는 PNP와 프로그램 적합도 모두를 약하게 만듭니다.",
      severity: "medium",
    },
    {
      title: "타이밍 민감도",
      body: "정책이나 초청 패턴이 다시 움직이면, 전략도 더 빨라져야 할 수 있습니다.",
      severity: "medium",
    },
  ],
};

export const assessmentSteps = [
  { label: "기본 정보", note: "나이, 거주지, 가족 상황, 일정 감각을 잡습니다." },
  { label: "학력", note: "최고 학위와 ECA 여부를 확인합니다." },
  { label: "근무 경력", note: "총 경력, TEER, 직무 적합도를 봅니다." },
  { label: "캐나다 경력", note: "캐나다 근무 월수와 연속성을 체크합니다." },
  { label: "언어", note: "영어 점수와 시험 종류를 입력합니다." },
  { label: "프랑스어", note: "프랑스어 정합도와 업사이드를 평가합니다." },
  { label: "주·경로", note: "BC, 연방, 하이브리드 중 어디에 무게를 둘지 정합니다." },
];

export const pathways = [
  {
    name: "BC PNP",
    status: "가장 강함",
    summary: "직무, 고용주 지원, BC 연결이 깔끔하게 맞을 때 가장 유리합니다.",
    fit: 82,
    evidence: "잡오퍼와 TEER 정합성이 현재의 핵심 앵커입니다.",
    gap: "최종 직무 매핑과 고용주 증빙을 다시 확인해야 합니다.",
  },
  {
    name: "Express Entry",
    status: "관찰",
    summary: "언어 또는 경력 상승이 있을 때 경쟁력이 더 살아납니다.",
    fit: 61,
    evidence: "현재는 일반 CRS만으로는 가장 쉬운 경로가 아닙니다.",
    gap: "더 강한 언어 점수나 카테고리 우위가 필요합니다.",
  },
  {
    name: "프랑스어 중심 경로",
    status: "업사이드",
    summary: "CLB7 프랑스어 시나리오는 전략을 크게 바꿀 수 있습니다.",
    fit: 74,
    evidence: "핵심 프로필이 평범해도 프랑스어는 두 번째 길을 만듭니다.",
    gap: "의도적인 프랑스어 계획이 필요합니다.",
  },
  {
    name: "CEC 하이브리드",
    status: "미래",
    summary: "캐나다 경력이 더 쌓이면 의미가 커집니다.",
    fit: 55,
    evidence: "다음 전환점을 추적하기에 좋은 후보입니다.",
    gap: "캐나다 근무 1년이 더 필요합니다.",
  },
];

export const scenarios: Scenario[] = [
  {
    title: "프랑스어 CLB7",
    subtitle: "언어 축이 바뀌면 경로 조합도 달라집니다.",
    delta: "+18 전략 포인트",
    impact: "긍정",
    result: "프로필이 더 차별화된 EE 경로로 이동합니다.",
    action: "프랑스어 시험 계획을 잡으세요.",
  },
  {
    title: "영어 점수 상승",
    subtitle: "핵심 CRS 기준을 높여줍니다.",
    delta: "+10 전략 포인트",
    impact: "긍정",
    result: "도움은 되지만 강한 PNP 경로를 완전히 앞서진 못할 수 있습니다.",
    action: "목표 점수와 재응시 시점을 정하세요.",
  },
  {
    title: "캐나다 경력 1년 추가",
    subtitle: "경로 유연성을 넓혀줍니다.",
    delta: "+12 전략 포인트",
    impact: "긍정",
    result: "CEC 스토리가 선명해지고, 리스크가 줄어듭니다.",
    action: "정확한 자격 시점을 계산하세요.",
  },
  {
    title: "주 변경",
    subtitle: "현재 주정부 정합성이 약해질 때의 대안입니다.",
    delta: "혼합",
    impact: "주의",
    result: "고용주와 직무 정합성에 따라 도움이 될 수도, 약해질 수도 있습니다.",
    action: "두 번째 주 시나리오를 준비해 두세요.",
  },
];

export const roadmap = [
  {
    title: "이번 주",
    detail: "언어 점수를 잠그고, TEER를 확인하고, 근무 이력을 마무리합니다.",
    owner: "사용자",
    status: "doing",
  },
  {
    title: "2주 내",
    detail: "프랑스어 CLB7과 CEC 시나리오를 시뮬레이터에 추가합니다.",
    owner: "전략",
    status: "todo",
  },
  {
    title: "다음 달",
    detail: "경로별 공식 근거와 개인 행동 체크포인트를 정리합니다.",
    owner: "근거",
    status: "todo",
  },
  {
    title: "상시",
    detail: "새 PR 신호를 보고, draw 패턴이 움직일 때 계획을 업데이트합니다.",
    owner: "신호",
    status: "todo",
  },
];

export const returningUpdates = [
  {
    label: "새 신호",
    value: "프랑스어 경로 기회가 강화됨",
    detail: "이제 전략 카드 최상단에 프랑스어가 다시 올라옵니다.",
  },
  {
    label: "리스크 변화",
    value: "언어 리스크가 소폭 상승",
    detail: "영어 점수는 여전히 유효하지만, 이전보다 결정력이 약해졌습니다.",
  },
  {
    label: "다음 행동",
    value: "프랑스어 CLB7과 CEC 1년 시뮬레이션",
    detail: "가장 유력한 백업 경로를 먼저 검증하는 것이 좋습니다.",
  },
];
