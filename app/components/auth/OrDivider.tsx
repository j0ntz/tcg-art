// Thin "or" separator between the OAuth button and the credentials form.
const OrDivider: React.FC = () => (
  <div className="flex items-center gap-3 text-sm text-foreground-subtle">
    <span className="h-px flex-1 bg-border" />
    or
    <span className="h-px flex-1 bg-border" />
  </div>
);

export default OrDivider;
