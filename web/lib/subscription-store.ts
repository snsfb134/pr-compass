import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { affiliationOptions, type Affiliation } from "@/lib/subscription-options";

export type Subscription = {
  id: string;
  token: string;
  name: string;
  email: string;
  affiliation: Affiliation;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  subscriptions: Subscription[];
};

export type SubscriptionFieldErrors = {
  name?: string;
  email?: string;
  affiliation?: string;
};

const dataDir = path.join(process.cwd(), ".local-data");
const storePath = path.join(dataDir, "pr-compass-subscriptions.json");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readStore(): Promise<Store> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [] };
  } catch {
    return { subscriptions: [] };
  }
}

async function writeStore(store: Store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export function validateSubscriptionInput(name: string, email: string, affiliation: string) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanAffiliation = affiliation.trim();
  const fieldErrors: SubscriptionFieldErrors = {};

  if (!cleanName) {
    fieldErrors.name = "이름을 입력해 주세요.";
  } else if (cleanName.length < 2) {
    fieldErrors.name = "이름은 2자 이상 입력해 주세요.";
  }

  if (!cleanEmail) {
    fieldErrors.email = "이메일을 입력해 주세요.";
  } else if (!emailPattern.test(cleanEmail)) {
    fieldErrors.email = "이메일 형식이 올바르지 않습니다.";
  }

  if (!affiliationOptions.includes(cleanAffiliation as Affiliation)) {
    fieldErrors.affiliation = "소속을 선택해 주세요.";
  }

  const valid = Object.keys(fieldErrors).length === 0;
  return {
    valid,
    message: valid ? "" : "구독 정보를 다시 확인해 주세요.",
    fieldErrors,
    value: valid
      ? {
          name: cleanName,
          email: cleanEmail,
          affiliation: cleanAffiliation as Affiliation,
        }
      : null,
  };
}

export async function upsertSubscription(name: string, email: string, affiliation: string) {
  const validation = validateSubscriptionInput(name, email, affiliation);
  if (!validation.valid || !validation.value) {
    const error = new Error(validation.message) as Error & { fieldErrors?: SubscriptionFieldErrors };
    error.fieldErrors = validation.fieldErrors;
    throw error;
  }
  const value = validation.value;

  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.subscriptions.find((subscription) => subscription.email === value.email);

  if (existing) {
    existing.name = value.name;
    existing.affiliation = value.affiliation;
    existing.active = true;
    existing.updatedAt = now;
    await writeStore(store);
    return { subscription: publicSubscription(existing), created: false };
  }

  const subscription: Subscription = {
    id: randomBytes(12).toString("hex"),
    token: randomBytes(18).toString("hex"),
    name: value.name,
    email: value.email,
    affiliation: value.affiliation,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  store.subscriptions.push(subscription);
  await writeStore(store);
  return { subscription: publicSubscription(subscription), created: true };
}

export async function findSubscriptionByToken(token: string) {
  const store = await readStore();
  const subscription = store.subscriptions.find((item) => item.token === token && item.active);
  return subscription ? publicSubscription(subscription) : null;
}

export function publicSubscription(subscription: Subscription) {
  return {
    id: subscription.id,
    token: subscription.token,
    name: subscription.name,
    email: subscription.email,
    affiliation: subscription.affiliation,
    active: subscription.active,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}
