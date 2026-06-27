// "Build Your Binder" section, matching the clone target's feature pitch:
// drag-and-drop grids, themes, and shareable links. These are roadmap features
// (v3 in docs/spec.md), so this section is a display-only marketing tease.
const FEATURES = [
  {
    title: "Drag-and-drop pages",
    body: "Arrange your favorite cards into beautiful binder layouts, just like a physical page.",
  },
  {
    title: "18+ themes",
    body: "Pokéball patterns, ocean gradients, solid colors, and card-sleeve looks to set the mood.",
  },
  {
    title: "Shareable links",
    body: "Generate a link to any binder page and share your collection with friends.",
  },
] as const;

const BuildYourBinder: React.FC = () => {
  return (
    <section className="border-y border-zinc-200 bg-gradient-to-br from-indigo-600 to-violet-700">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4 text-white">
          <h2 className="text-3xl font-bold tracking-tight">Build Your Binder</h2>
          <p className="max-w-lg text-violet-100">
            Collecting is half the fun. Save the cards you love and organize them into custom
            binder pages you can show off.
          </p>
        </div>

        <ul className="grid gap-4">
          {FEATURES.map(feature => (
            <li
              key={feature.title}
              className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur"
            >
              <h3 className="font-semibold text-white">{feature.title}</h3>
              <p className="mt-1 text-sm text-violet-100">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default BuildYourBinder;
