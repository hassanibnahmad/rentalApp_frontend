import axios from "axios";

const configuredBaseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isProduction = import.meta.env.PROD;
const fallbackBaseURL = isProduction
  ? "https://rentalapp-backend-tz9z.onrender.com"
  : "http://localhost:8080";
const resolvedBaseURL = (configuredBaseURL && configuredBaseURL.length > 0
  ? configuredBaseURL
  : fallbackBaseURL
).replace(/\/$/, "");

if (!configuredBaseURL) {
  console.warn(
    `VITE_API_BASE_URL is missing. Using fallback backend: ${resolvedBaseURL}. Set VITE_API_BASE_URL in Vercel project settings.`,
  );
}

const SESSION_STORAGE_KEY = "julia-auth-session";

export const apiClient = axios.create({
  baseURL: `${resolvedBaseURL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const setApiClientAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }
  const headers = axios.AxiosHeaders.from(config.headers);
  if (!headers.has("Authorization")) {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as { token?: string };
        if (parsed?.token) {
          headers.set("Authorization", `Bearer ${parsed.token}`);
        }
      } catch (error) {
        console.warn("Session storage corrompue. Suppression.", error);
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }
  config.headers = headers;
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// Automation API (WhatsApp flows)
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus = "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type AutomationEventType =
  | "BOOKING_STARTED"
  | "BOOKING_CONFIRMED"
  | "RENTAL_UPCOMING"
  | "RENTAL_COMPLETED";

export interface AutomationEvent {
  id: string;
  type: AutomationEventType;
  source: string;
  externalId?: string;
  processed: boolean;
  flowCount: number;
  error?: string;
  receivedAt: string;
  processedAt?: string;
}

export interface AutomationJob {
  id: string;
  eventId: string;
  flow: string;
  status: JobStatus;
  actionIndex: number;
  attempts: number;
  runAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface WhatsAppMessage {
  id: string;
  jobId?: string;
  templateId: string;
  body: string;
  toPhone: string;
  providerMessageId?: string;
  status: MessageStatus;
  providerError?: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface MessageTemplate {
  id: string;
  variables: string[];
  body: string;
}

export interface FlowDefinition {
  name: string;
  triggerEvent: string;
  description: string;
  actionCount: number;
}

const toQueryString = (params: Record<string, string | number | undefined>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) {
      q.set(k, String(v));
    }
  }
  return q.toString();
};

export const automationApi = {
  health: () => apiClient.get<{ status: string; events: number; jobs: number; messages: number }>("/automation/health").then((r) => r.data),

  listEvents: (limit = 50) =>
    apiClient
      .get<AutomationEvent[]>(`/automation/events?${toQueryString({ limit })}`)
      .then((r) => r.data),

  listJobs: (params: { status?: JobStatus; flow?: string; limit?: number; offset?: number } = {}) =>
    apiClient
      .get<AutomationJob[]>(`/automation/jobs?${toQueryString(params)}`)
      .then((r) => r.data),

  trigger: (reservationId: string | number, flow: string) =>
    apiClient
      .post<{ ok: boolean; eventId: string; flowsTriggered: string[]; duplicate?: boolean }>(
        "/automation/jobs/trigger",
        { reservationId, flow },
      )
      .then((r) => r.data),

  listMessages: (params: { templateId?: string; status?: MessageStatus; limit?: number } = {}) =>
    apiClient
      .get<WhatsAppMessage[]>(`/automation/messages?${toQueryString(params)}`)
      .then((r) => r.data),

  listTemplates: () =>
    apiClient.get<MessageTemplate[]>("/automation/templates").then((r) => r.data),

  listFlows: () =>
    apiClient.get<FlowDefinition[]>("/automation/flows").then((r) => r.data),

  emitEvent: (type: AutomationEventType, reservationId: string | number, metadata?: Record<string, unknown>) =>
    apiClient
      .post("/automation/events", { type, reservationId, source: "admin-ui", metadata })
      .then((r) => r.data),
};

export default apiClient;
