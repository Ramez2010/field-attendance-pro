export function LoadingState() {
  return <div className="state-card">Loading...</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card danger">{message}</div>;
}
