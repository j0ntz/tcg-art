// Card detail loading state: art placeholder at the real aspect ratio plus a
// metadata ledger skeleton, matching the loaded layout.
const CardDetailLoading: React.FC = () => (
  <main
    className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10"
    aria-busy="true"
    aria-label="Loading card"
  >
    <div className="h-4 w-56 animate-pulse rounded-field bg-surface-hover" />
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <div className="aspect-[734/1024] w-full animate-pulse rounded-field bg-surface-hover" />
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="h-11 w-80 max-w-full animate-pulse rounded-field bg-surface-hover" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-8 w-full animate-pulse rounded-field bg-surface-hover" />
          ))}
        </div>
      </div>
    </div>
  </main>
);

export default CardDetailLoading;
