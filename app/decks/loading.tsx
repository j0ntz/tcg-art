// Deck-list loading state: header, create-form slot, and pulsing ledger rows
// matching the loaded layout.
const DecksLoading: React.FC = () => (
  <main
    className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-gutter py-10"
    aria-busy="true"
    aria-label="Loading decks"
  >
    <div className="h-10 w-64 animate-pulse rounded-field bg-surface-hover" />
    <div className="h-11 w-full max-w-md animate-pulse rounded-pill bg-surface-hover" />
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="h-16 animate-pulse rounded-field bg-surface-hover" />
      ))}
    </ul>
  </main>
);

export default DecksLoading;
