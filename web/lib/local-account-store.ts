import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateLoginInput, validateSignupInput } from "@/lib/auth-validation";

export type LocalUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

export type NotificationSettings = {
  categories: string[];
  minimumImportance: "high" | "medium" | "all";
  profileImpact: boolean;
  frequency: "instant" | "daily" | "weekly";
  updatedAt: string;
};

type Store = {
  users: LocalUser[];
  sessions: Array<{ token: string; userId: string; createdAt: string }>;
  notificationSettings: Record<string, NotificationSettings>;
};

const dataDir = path.join(process.cwd(), ".local-data");
const storePath = path.join(dataDir, "pr-compass-local-store.json");

const defaultSettings: NotificationSettings = {
  categories: ["BC PNP", "Express Entry", "처리기간", "정책 변경"],
  minimumImportance: "medium",
  profileImpact: true,
  frequency: "daily",
  updatedAt: new Date(0).toISOString(),
};

async function readStore(): Promise<Store> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      users: parsed.users || [],
      sessions: parsed.sessions || [],
      notificationSettings: parsed.notificationSettings || {},
    };
  } catch {
    return { users: [], sessions: [], notificationSettings: {} };
  }
}

async function writeStore(store: Store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const passwordHash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, passwordHash };
}

function verifyPassword(password: string, user: LocalUser) {
  const hash = hashPassword(password, user.salt).passwordHash;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createLocalUser(username: string, email: string, password: string) {
  const validation = validateSignupInput(username, email, password);
  if (!validation.valid) {
    const error = new Error(validation.message) as Error & { fieldErrors?: Record<string, string> };
    error.fieldErrors = validation.fieldErrors;
    throw error;
  }
  const { username: cleanUsername, email: cleanEmail, password: cleanPassword } = validation.value;

  const store = await readStore();
  const exists = store.users.some((user) => user.username === cleanUsername || user.email === cleanEmail);
  if (exists) throw new Error("이미 사용 중인 아이디 또는 이메일입니다.");

  const { salt, passwordHash } = hashPassword(cleanPassword);
  const user: LocalUser = {
    id: randomBytes(12).toString("hex"),
    username: cleanUsername,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await writeStore(store);
  return createSession(user.id);
}

export async function loginLocalUser(identifier: string, password: string) {
  const validation = validateLoginInput(identifier, password);
  if (!validation.valid) {
    const error = new Error(validation.message) as Error & { fieldErrors?: Record<string, string> };
    error.fieldErrors = validation.fieldErrors;
    throw error;
  }
  const store = await readStore();
  const cleanIdentifier = validation.value.identifier?.toLowerCase() || "";
  const user = store.users.find((item) => item.username.toLowerCase() === cleanIdentifier || item.email === cleanIdentifier);
  if (!user || !verifyPassword(validation.value.password, user)) throw new Error("아이디 또는 비밀번호를 확인해 주세요.");
  return createSession(user.id);
}

export async function createSession(userId: string) {
  const store = await readStore();
  const token = randomBytes(24).toString("hex");
  store.sessions = [...store.sessions.filter((session) => session.userId !== userId), { token, userId, createdAt: new Date().toISOString() }];
  await writeStore(store);
  return { token, user: publicUser(store.users.find((item) => item.id === userId) || null) };
}

export async function getSessionUser(token?: string) {
  if (!token) return null;
  const store = await readStore();
  const session = store.sessions.find((item) => item.token === token);
  const user = session ? store.users.find((item) => item.id === session.userId) || null : null;
  return publicUser(user);
}

export async function clearSession(token?: string) {
  if (!token) return;
  const store = await readStore();
  store.sessions = store.sessions.filter((session) => session.token !== token);
  await writeStore(store);
}

export async function getNotificationSettings(userId = "public") {
  const store = await readStore();
  return store.notificationSettings[userId] || { ...defaultSettings };
}

export async function saveNotificationSettings(settings: Omit<NotificationSettings, "updatedAt">, userId = "public") {
  const store = await readStore();
  const next = { ...settings, updatedAt: new Date().toISOString() };
  store.notificationSettings[userId] = next;
  await writeStore(store);
  return next;
}

function publicUser(user: LocalUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}
