// Deck-detail loading state: breadcrumb, header, and the pulsing card grid
// with rail space, matching the loaded layout.
const DeckLoading: React.FC = () => (
  <main
    className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10"
    aria-busy="true"
    aria-label="Loading deck"
  >
    <div className="h-5 w-40 animate-pulse rounded-field bg-surface-hover" />
    <div className="h-10 w-72 animate-pulse rounded-field bg-surface-hover" />
    <div className="flex gap-10">
      <div className="hidden h-96 w-60 shrink-0 animate-pulse rounded-panel bg-surface-hover lg:block" />
      <ul className="grid flex-1 grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <li
            key={index}
            className="aspect-[245/342] animate-pulse rounded-field bg-surface-hover"
          />
        ))}
      </ul>
    </div>
  </main>
);

export default DeckLoading;
