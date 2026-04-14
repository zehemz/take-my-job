import type { AgentStatus } from '@/lib/kanban-types';

interface Props {
  status: AgentStatus;
  retryAfterMs?: number | null;
}

function Spinner() {
  return (
    <svg
      className="w-2.5 h-2.5 animate-spin"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 1a4 4 0 1 1-4 4" />
    </svg>
  );
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { bg: string; text: string; border: string; label: string; icon: React.ReactNode }
> = {
  idle: {
    bg: 'bg-zinc-700',
    text: 'text-zinc-300',
    border: 'border-l-zinc-500',
    label: 'Idle',
    icon: <span>○</span>,
  },
  queued: {
    bg: 'bg-cyan-900',
    text: 'text-cyan-200',
    border: 'border-l-cyan-400',
    label: 'Queued',
    icon: <span>◌</span>,
  },
  running: {
    bg: 'bg-indigo-900',
    text: 'text-indigo-200',
    border: 'border-l-indigo-400',
    label: 'Running',
    icon: <Spinner />,
  },
  blocked: {
    bg: 'bg-amber-900',
    text: 'text-amber-200',
    border: 'border-l-amber-400',
    label: 'Blocked',
    icon: <span>⚠</span>,
  },
  evaluating: {
    bg: 'bg-sky-900',
    text: 'text-sky-200',
    border: 'border-l-sky-400',
    label: 'Evaluating',
    icon: <Spinner />,
  },
  'evaluation-failed': {
    bg: 'bg-rose-900',
    text: 'text-rose-200',
    border: 'border-l-rose-400',
    label: 'Eval Failed',
    icon: <span>✗</span>,
  },
  'pending-approval': {
    bg: 'bg-violet-900',
    text: 'text-violet-200',
    border: 'border-l-violet-400',
    label: 'Pending Approval',
    icon: <span>⏳</span>,
  },
  completed: {
    bg: 'bg-emerald-900',
    text: 'text-emerald-200',
    border: 'border-l-emerald-400',
    label: 'Completed',
    icon: <span>✓</span>,
  },
  failed: {
    bg: 'bg-red-900',
    text: 'text-red-200',
    border: 'border-l-red-400',
    label: 'Failed',
    icon: <span>✗</span>,
  },
};

export default function AgentStatusBadge({ status, retryAfterMs }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold border-l-4 ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.icon}
      {cfg.label}
      {status === 'failed' && retryAfterMs != null && (
        <span className="ml-0.5">· retry in {Math.ceil(retryAfterMs / 1000)}s</span>
      )}
    </span>
  );
}
