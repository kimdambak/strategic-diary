// localStorage 래퍼. 저장이 막힌 환경(사생활 보호 모드 등)에서도 화면은 동작해야 한다.
import { DEFAULT_AXES } from './logic.js';

const KEY = 'strategic-diary:v1';

export function defaultStore() {
  return {
    version: 1,
    state: {
      axes: DEFAULT_AXES.map((a) => ({ ...a })),
      focus: [],
      asIs: '',
      toBe: '',
    },
    days: {},
  };
}

let memory = null;

export function load() {
  if (memory) return memory;
  let store = defaultStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = normalize(JSON.parse(raw));
  } catch {
    /* 저장소 접근 실패 또는 손상: 기본값으로 시작 */
  }
  memory = store;
  return memory;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}

export function replaceAll(data) {
  memory = normalize(data);
  return save();
}

/** 가져온 데이터가 일부 비어 있어도 앱이 깨지지 않도록 기본값으로 채운다. */
export function normalize(data) {
  const base = defaultStore();
  const s = data && typeof data === 'object' ? data : {};
  const state = s.state && typeof s.state === 'object' ? s.state : {};
  return {
    version: 1,
    state: {
      axes: Array.isArray(state.axes) && state.axes.length ? state.axes : base.state.axes,
      focus: Array.isArray(state.focus) ? state.focus.slice(0, 2) : [],
      asIs: typeof state.asIs === 'string' ? state.asIs : '',
      toBe: typeof state.toBe === 'string' ? state.toBe : '',
    },
    days: s.days && typeof s.days === 'object' ? s.days : {},
  };
}
