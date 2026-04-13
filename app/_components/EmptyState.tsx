interface Props {
  message?: string;
}

export default function EmptyState({ message = 'Nothing here yet' }: Props) {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="text-sm text-zinc-600">{message}</span>
    </div>
  );
}
