import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Mail,
  Play,
  RefreshCcw,
  Send,
  XCircle,
  Zap,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { resolveFriendlyError } from "@/lib/errors";
import { automationApi, type AutomationEvent, type AutomationJob, type FlowDefinition, type JobStatus, type MessageStatus, type MessageTemplate, type WhatsAppMessage } from "@/lib/api-client";

type Tab = "jobs" | "messages" | "events" | "flows" | "templates";

const statusColor: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  RUNNING: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  COMPLETED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  FAILED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  CANCELLED: "bg-slate-500/15 text-slate-200 border-slate-500/30",
};

const messageStatusColor: Record<MessageStatus, string> = {
  QUEUED: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  SENT: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  DELIVERED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  READ: "bg-emerald-500/25 text-emerald-100 border-emerald-500/40",
  FAILED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

const formatDate = (raw?: string) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
};

export const AdminAutomationPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("jobs");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [flowFilter, setFlowFilter] = useState<string>("");
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [messageStatusFilter, setMessageStatusFilter] = useState<MessageStatus | "">("");

  // ── queries ─────────────────────────────────────────────────────────
  const jobsQuery = useQuery({
    queryKey: ["automation-jobs", statusFilter, flowFilter],
    queryFn: () => automationApi.listJobs({
      status: statusFilter || undefined,
      flow: flowFilter || undefined,
      limit: 100,
    }),
    refetchInterval: 5_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["automation-messages", templateFilter, messageStatusFilter],
    queryFn: () => automationApi.listMessages({
      templateId: templateFilter || undefined,
      status: messageStatusFilter || undefined,
      limit: 100,
    }),
    refetchInterval: 5_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["automation-events"],
    queryFn: () => automationApi.listEvents(50),
    refetchInterval: 10_000,
  });

  const flowsQuery = useQuery({
    queryKey: ["automation-flows"],
    queryFn: () => automationApi.listFlows(),
  });

  const templatesQuery = useQuery({
    queryKey: ["automation-templates"],
    queryFn: () => automationApi.listTemplates(),
  });

  const healthQuery = useQuery({
    queryKey: ["automation-health"],
    queryFn: () => automationApi.health(),
    refetchInterval: 10_000,
  });

  // ── actions ─────────────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["automation-jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["automation-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["automation-events"] });
    void queryClient.invalidateQueries({ queryKey: ["automation-health"] });
  }, [queryClient]);

  const handleTrigger = useCallback(
    async (reservationId: string, flow: string) => {
      try {
        await automationApi.trigger(reservationId, flow);
        toast({ title: "Flow déclenché", description: `Le flow « ${flow} » a été planifié.` });
        refreshAll();
      } catch (error) {
        toast({ title: "Impossible de déclencher le flow", description: resolveFriendlyError(error), variant: "destructive" });
      }
    },
    [toast, refreshAll],
  );

  // Auto-refresh while user is on the page.
  useEffect(() => {
    const id = setInterval(refreshAll, 8_000);
    return () => clearInterval(id);
  }, [refreshAll]);

  const flowNames = useMemo(
    () => (flowsQuery.data ?? []).map((f: FlowDefinition) => f.name),
    [flowsQuery.data],
  );

  const counts = {
    scheduled: (jobsQuery.data ?? []).filter((j: AutomationJob) => j.status === "SCHEDULED").length,
    running: (jobsQuery.data ?? []).filter((j: AutomationJob) => j.status === "RUNNING").length,
    failed: (jobsQuery.data ?? []).filter((j: AutomationJob) => j.status === "FAILED").length,
    completed: (jobsQuery.data ?? []).filter((j: AutomationJob) => j.status === "COMPLETED").length,
    messagesSent: (messagesQuery.data ?? []).filter((m: WhatsAppMessage) => m.status === "SENT" || m.status === "DELIVERED" || m.status === "READ").length,
    messagesFailed: (messagesQuery.data ?? []).filter((m: WhatsAppMessage) => m.status === "FAILED").length,
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-50">
            <Zap className="h-6 w-6 text-blue-400" />
            Automation WhatsApp
          </h1>
          <p className="text-sm text-slate-400">
            Suivi en temps réel des flows, jobs, événements et messages envoyés.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Rafraîchir
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Jobs planifiés" value={counts.scheduled} icon={Clock} color="text-blue-300" />
        <KpiCard label="Jobs en cours" value={counts.running} icon={Loader2} color="text-amber-300" />
        <KpiCard label="Jobs terminés" value={counts.completed} icon={CheckCircle2} color="text-emerald-300" />
        <KpiCard label="Jobs échoués" value={counts.failed} icon={XCircle} color="text-rose-300" />
        <KpiCard label="Messages envoyés" value={counts.messagesSent} icon={Send} color="text-emerald-300" />
        <KpiCard label="Messages échoués" value={counts.messagesFailed} icon={BellRing} color="text-rose-300" />
      </div>

      {/* Health */}
      {healthQuery.data && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            <Activity className="mr-1 inline-block h-3 w-3" />
            Automation service
          </p>
          <p className="mt-2">
            Statut : <span className="font-medium text-emerald-300">{String(healthQuery.data.status)}</span> ·{" "}
            Événements : {String(healthQuery.data.events)} · Jobs : {String(healthQuery.data.jobs)} · Messages : {String(healthQuery.data.messages)}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["jobs", "messages", "events", "flows", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "rounded-2xl border px-4 py-2 text-sm transition",
              tab === t
                ? "border-blue-500/40 bg-blue-500/15 text-blue-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
            ].join(" ")}
          >
            {labelFor(t)}
          </button>
        ))}
      </div>

      {tab === "jobs" && (
        <JobsPanel
          jobs={jobsQuery.data ?? []}
          loading={jobsQuery.isLoading}
          flowOptions={flowNames}
          statusFilter={statusFilter}
          flowFilter={flowFilter}
          onStatusFilter={setStatusFilter}
          onFlowFilter={setFlowFilter}
          onTrigger={handleTrigger}
        />
      )}

      {tab === "messages" && (
        <MessagesPanel
          messages={messagesQuery.data ?? []}
          loading={messagesQuery.isLoading}
          templateFilter={templateFilter}
          statusFilter={messageStatusFilter}
          onTemplateFilter={setTemplateFilter}
          onStatusFilter={setMessageStatusFilter}
          templates={(templatesQuery.data ?? []).map((t: MessageTemplate) => t.id)}
        />
      )}

      {tab === "events" && (
        <EventsPanel events={eventsQuery.data ?? []} loading={eventsQuery.isLoading} />
      )}

      {tab === "flows" && (
        <FlowsPanel flows={flowsQuery.data ?? []} loading={flowsQuery.isLoading} />
      )}

      {tab === "templates" && (
        <TemplatesPanel templates={templatesQuery.data ?? []} loading={templatesQuery.isLoading} />
      )}
    </div>
  );
};

const labelFor = (t: Tab): string => {
  switch (t) {
    case "jobs":      return "Jobs";
    case "messages":  return "Messages";
    case "events":    return "Événements";
    case "flows":     return "Flows";
    case "templates": return "Templates";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
    <p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p>
  </div>
);

const JobsPanel = ({
  jobs,
  loading,
  flowOptions,
  statusFilter,
  flowFilter,
  onStatusFilter,
  onFlowFilter,
  onTrigger,
}: {
  jobs: AutomationJob[];
  loading: boolean;
  flowOptions: string[];
  statusFilter: JobStatus | "";
  flowFilter: string;
  onStatusFilter: (s: JobStatus | "") => void;
  onFlowFilter: (s: string) => void;
  onTrigger: (reservationId: string, flow: string) => void;
}) => {
  const [reservationId, setReservationId] = useState("");
  const [flow, setFlow] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="h-4 w-4" /> Filtres
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as JobStatus | "")}
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Tous les statuts</option>
          {Object.keys(statusColor).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={flowFilter}
          onChange={(e) => onFlowFilter(e.target.value)}
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Tous les flows</option>
          {flowOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <input
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            placeholder="ID réservation"
            className="w-32 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={flow}
            onChange={(e) => setFlow(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Choisir un flow…</option>
            {flowOptions.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!reservationId || !flow}
            onClick={() => onTrigger(reservationId, flow)}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/30 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Déclencher
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Flow</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Run at</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Finished</th>
              <th className="px-4 py-3">Tentatives</th>
              <th className="px-4 py-3">Action #</th>
              <th className="px-4 py-3">Erreur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Aucun job. Déclenchez un événement pour démarrer.
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} className="bg-white/[0.02] text-slate-200">
                <td className="px-4 py-3 font-medium">{j.flow}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusColor[j.status]}`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(j.runAt)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(j.startedAt)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(j.finishedAt)}</td>
                <td className="px-4 py-3 text-slate-400">{j.attempts}</td>
                <td className="px-4 py-3 text-slate-400">{j.actionIndex}</td>
                <td className="px-4 py-3 text-rose-300">{j.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MessagesPanel = ({
  messages,
  loading,
  templateFilter,
  statusFilter,
  onTemplateFilter,
  onStatusFilter,
  templates,
}: {
  messages: WhatsAppMessage[];
  loading: boolean;
  templateFilter: string;
  statusFilter: MessageStatus | "";
  onTemplateFilter: (s: string) => void;
  onStatusFilter: (s: MessageStatus | "") => void;
  templates: string[];
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Filter className="h-4 w-4" /> Filtres
      </div>
      <select
        value={templateFilter}
        onChange={(e) => onTemplateFilter(e.target.value)}
        className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
      >
        <option value="">Tous les templates</option>
        {templates.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as MessageStatus | "")}
        className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100"
      >
        <option value="">Tous les statuts</option>
        {Object.keys(messageStatusColor).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>

    <div className="space-y-3">
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-slate-500">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      )}
      {!loading && messages.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-slate-500">
          Aucun message WhatsApp envoyé pour l'instant.
        </div>
      )}
      {messages.map((m) => (
        <div key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-300" />
              <span className="text-sm font-medium text-slate-100">{m.templateId}</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${messageStatusColor[m.status]}`}>
                {m.status}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              À {m.toPhone} · {formatDate(m.sentAt)}
              {m.deliveredAt ? ` · livré ${formatDate(m.deliveredAt)}` : ""}
              {m.readAt ? ` · lu ${formatDate(m.readAt)}` : ""}
            </div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
            {m.body}
          </pre>
          {m.providerError && (
            <p className="mt-2 text-xs text-rose-300">⚠ {m.providerError}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

const EventsPanel = ({ events, loading }: { events: AutomationEvent[]; loading: boolean }) => (
  <div className="overflow-hidden rounded-2xl border border-white/10">
    <table className="w-full text-sm">
      <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-slate-400">
        <tr>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3">Source</th>
          <th className="px-4 py-3">Réservation</th>
          <th className="px-4 py-3">Flows</th>
          <th className="px-4 py-3">Reçu</th>
          <th className="px-4 py-3">Traité</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {loading && (
          <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
        )}
        {!loading && events.length === 0 && (
          <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Aucun événement.</td></tr>
        )}
        {events.map((e) => (
          <tr key={e.id} className="bg-white/[0.02] text-slate-200">
            <td className="px-4 py-3 font-medium">{e.type}</td>
            <td className="px-4 py-3 text-slate-400">{e.source}</td>
            <td className="px-4 py-3 text-slate-400">{e.externalId ?? "—"}</td>
            <td className="px-4 py-3 text-slate-400">{e.flowCount}</td>
            <td className="px-4 py-3 text-slate-400">{formatDate(e.receivedAt)}</td>
            <td className="px-4 py-3 text-slate-400">{formatDate(e.processedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FlowsPanel = ({ flows, loading }: { flows: FlowDefinition[]; loading: boolean }) => {
  const { toast } = useToast();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-slate-500 md:col-span-2 xl:col-span-3">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      )}
      {!loading && flows.map((f) => (
        <div key={f.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">{f.name}</p>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-xs text-blue-200">
              {f.triggerEvent}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{f.description}</p>
          <p className="mt-3 text-xs text-slate-500">{f.actionCount} actions</p>
        </div>
      ))}
    </div>
  );
};

const TemplatesPanel = ({ templates, loading }: { templates: MessageTemplate[]; loading: boolean }) => (
  <div className="space-y-3">
    {loading && (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-slate-500">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    )}
    {templates.map((t) => (
      <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">{t.id}</p>
          <span className="text-xs text-slate-500">{t.variables.length} variables</span>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
          {t.body}
        </pre>
      </div>
    ))}
  </div>
);
