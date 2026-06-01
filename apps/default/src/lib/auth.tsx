/**
 * Custom auth system — no OIDC.
 * Users are stored as nodes in the Taskade project.
 * Session is persisted in localStorage.
 *
 * User node structure:
 *   text:  "__auth:{username}__"
 *   @sub08: hashed PIN (SHA-256 hex)
 *   parentId: null (top-level, like userRoot nodes)
 *
 * The "userId" used throughout the app is the username itself (lowercase).
 */

import axios from 'axios';

const AUTH_PREFIX = '__auth:';
// Dedicated project for user accounts (separate from study subjects)
const AUTH_PROJECT_ID = 'BPZCZdop7dsZtmxH';
const BASE = `/api/taskade/projects/${AUTH_PROJECT_ID}/nodes`;
const SESSION_KEY = 'study_session';

export type AuthUser = {
  username: string;
  nodeId: string;
};

/** Minimal SHA-256 hash using Web Crypto API */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeAuthText(username: string) {
  return `${AUTH_PREFIX}${username.toLowerCase()}__`;
}

function parseAuthText(text: string): string | null {
  if (!text.startsWith(AUTH_PREFIX) || !text.endsWith('__')) return null;
  return text.slice(AUTH_PREFIX.length, -2);
}

/** Load all nodes and find auth nodes */
async function fetchAuthNodes() {
  const res = await axios.get(BASE);
  const nodes = (res.data?.payload?.nodes ?? []) as Array<{
    id: string;
    parentId: string | null;
    fieldValues: Record<string, string | number | undefined>;
  }>;
  return nodes.filter((n) => {
    const text = n.fieldValues['/text'] ?? '';
    return parseAuthText(text) !== null;
  });
}

/** Check if a username already exists */
export async function usernameExists(username: string): Promise<boolean> {
  const nodes = await fetchAuthNodes();
  const target = makeAuthText(username);
  return nodes.some((n) => n.fieldValues['/text'] === target);
}

/** Register a new user. Throws if username taken. */
export async function register(username: string, pin: string): Promise<AuthUser> {
  const exists = await usernameExists(username);
  if (exists) throw new Error('El nombre de usuario ya existe');

  const pinHash = await sha256(pin);
  const res = await axios.post(BASE, {
    '/text': makeAuthText(username),
    '/attributes/note': pinHash,
  });

  const nodeId = res.data?.payload?.node?.id ?? '';
  const user: AuthUser = { username: username.toLowerCase(), nodeId };
  saveSession(user);
  return user;
}

/** Login an existing user. Throws if wrong credentials. */
export async function login(username: string, pin: string): Promise<AuthUser> {
  const nodes = await fetchAuthNodes();
  const target = makeAuthText(username);
  const node = nodes.find((n) => n.fieldValues['/text'] === target);
  if (!node) throw new Error('Usuario no encontrado');

  const pinHash = await sha256(pin);
  const storedHash = String(node.fieldValues['/attributes/note'] ?? '');
  if (pinHash !== storedHash) throw new Error('PIN incorrecto');

  const user: AuthUser = { username: username.toLowerCase(), nodeId: node.id };
  saveSession(user);
  return user;
}

/** Save session to localStorage */
function saveSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/** Load session from localStorage */
export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Clear session */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

