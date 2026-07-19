// Search route loading state: the band and a card grid as quiet pulsing
// placeholders that match the real layout, so the page does not jump when
// results arrive.
const SearchLoading: React.FC = () => (
  <main className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading search">
    <section className="border-b border-border">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-gutter py-10 sm:py-14">
        <div className="h-10 w-72 max-w-full animate-pulse rounded-field bg-surface-hover" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded-field bg-surface-hover" />
        <div className="h-12 w-full max-w-xl animate-pulse rounded-pill bg-surface-hover" />
      </div>
    </section>
    <div className="mx-auto w-full max-w-content px-gutter py-10">
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <li key={index} className="flex flex-col gap-2">
            <div className="aspect-[245/342] w-full animate-pulse rounded-field bg-surface-hover" />
            <div className="h-4 w-3/4 animate-pulse rounded-field bg-surface-hover" />
            <div className="h-3 w-1/2 animate-pulse rounded-field bg-surface-hover" />
          </li>
        ))}
      </ul>
    </div>
  </main>
);

export default SearchLoading;
