// Binder loading state: header plus a 3x3 sheet of pulsing sleeves, matching
// the binder-page layout so the swap to real cards is seamless.
const BinderLoading: React.FC = () => (
  <main
    className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-gutter py-10"
    aria-busy="true"
    aria-label="Loading binder"
  >
    <div className="h-10 w-64 animate-pulse rounded-field bg-surface-hover" />
    <div className="rounded-panel border border-border bg-surface-muted p-6">
      <ul className="grid grid-cols-3 gap-2 sm:gap-4">
        {Array.from({ length: 9 }, (_, index) => (
          <li
            key={index}
            className="aspect-[245/342] animate-pulse rounded-field bg-surface-hover"
          />
        ))}
      </ul>
    </div>
  </main>
);

export default BinderLoading;
