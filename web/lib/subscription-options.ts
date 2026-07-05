export const affiliationOptions = ["학생", "워홀/취업비자", "직장인", "유학원/컨설턴트", "기타"] as const;

export type Affiliation = (typeof affiliationOptions)[number];
