import type { AcceptanceCriterion, AgentStatus } from '@/lib/kanban-types';

interface Props {
  criteria: AcceptanceCriterion[];
  cardStatus: AgentStatus;
}

function CriterionIcon({ passed, isEvaluating }: { passed: boolean | null; isEvaluating: boolean }) {
  if (isEvaluating) {
    return (
      <svg className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0 mt-0.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 1a4 4 0 1 1-4 4" />
      </svg>
    );
  }
  if (passed === null) {
    return <span className="text-zinc-600 shrink-0 mt-0.5">◻</span>;
  }
  if (passed) {
    return <span className="text-emerald-400 shrink-0 mt-0.5">✅</span>;
  }
  return <span className="text-rose-400 shrink-0 mt-0.5">✗</span>;
}

export default function AcceptanceCriteriaList({ criteria, cardStatus }: Props) {
  const isEvaluating = cardStatus === 'evaluating';

  return (
    <ul className="flex flex-col gap-2 list-none m-0 p-0">
      {criteria.map((criterion) => (
        <li key={criterion.id} className="flex flex-col gap-0.5">
          <div className="flex items-start gap-2">
            <CriterionIcon passed={criterion.passed} isEvaluating={isEvaluating} />
            <span className="text-sm text-zinc-300">{criterion.text}</span>
          </div>
          {criterion.evidence && (
            <p className="ml-6 text-xs text-zinc-500 font-mono">{criterion.evidence}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
