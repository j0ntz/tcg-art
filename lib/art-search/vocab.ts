// Curated lexical-semantic bridge for the no-key ranking path. Each key is a
// word a user might type; the values are words the index rows actually contain
// (Haiku's descriptive vocabulary, TCG species/type names, weather/color
// families). Expansions score at a discount (see EXPANSION_WEIGHT) so a direct
// hit always outranks a synonym hit. When ANTHROPIC_API_KEY is present the
// Haiku query parser adds richer, query-specific expansion on top of this.
export const EXPANSION_WEIGHT = 0.7;

export const VOCAB: Record<string, string[]> = {
  // Moods and emotional readings of art.
  sad: ["melancholy", "gloomy", "sorrowful", "mournful", "somber", "crying", "lonely", "wistful"],
  happy: ["joyful", "cheerful", "playful", "gleeful", "smiling", "upbeat"],
  scary: ["eerie", "creepy", "spooky", "ominous", "haunting", "menacing", "sinister"],
  spooky: ["eerie", "creepy", "ominous", "haunting", "ghostly"],
  angry: ["fierce", "furious", "rage", "aggressive", "snarling"],
  calm: ["peaceful", "serene", "tranquil", "gentle", "quiet"],
  cute: ["adorable", "charming", "sweet", "chibi", "playful"],
  epic: ["dramatic", "grand", "majestic", "powerful", "dynamic"],
  mysterious: ["enigmatic", "mystic", "otherworldly", "shadowy"],

  // Weather and environments.
  rain: ["rainy", "raining", "storm", "stormy", "drizzle", "downpour", "wet"],
  storm: ["stormy", "thunder", "lightning", "tempest", "rain"],
  snow: ["snowy", "blizzard", "ice", "icy", "frozen", "winter"],
  night: ["dark", "moonlit", "midnight", "nocturnal", "starry", "moon"],
  ocean: ["sea", "wave", "waves", "water", "surf", "tide", "beach"],
  sea: ["ocean", "wave", "waves", "water", "underwater"],
  volcano: ["lava", "magma", "eruption", "volcanic", "molten", "fiery"],
  forest: ["woods", "woodland", "trees", "jungle", "grove", "foliage"],
  sky: ["clouds", "cloudy", "aerial", "soaring", "heavens"],
  cave: ["cavern", "underground", "rocky", "dark"],
  city: ["urban", "town", "buildings", "street"],
  space: ["cosmic", "stars", "galaxy", "nebula", "celestial"],
  moon: ["moonlit", "lunar", "night", "crescent", "full moon"],
  wave: ["ocean", "surf", "surfing", "water", "tide"],

  // Colors and palettes.
  red: ["crimson", "scarlet", "ruby"],
  orange: ["amber", "tangerine", "copper", "rust"],
  blue: ["azure", "navy", "teal", "cobalt"],
  purple: ["violet", "lavender", "magenta"],
  green: ["emerald", "verdant", "leafy"],
  yellow: ["golden", "gold", "amber"],
  black: ["dark", "shadow", "shadowy", "inky"],
  white: ["pale", "ivory", "snowy"],
  pink: ["rosy", "magenta", "pastel"],
  fiery: ["flame", "flames", "fire", "burning", "blazing"],

  // Size and scale canonicalization: the index rows carry "small"/"little"/
  // "large" far more often than a user's chosen synonym, so bridge them.
  tiny: ["small", "little", "miniature", "petite"],
  small: ["little", "tiny", "petite"],
  big: ["large", "huge", "giant", "massive"],
  large: ["big", "huge", "giant", "massive"],

  // Weather canonicalization: "snowstorm"/"blizzard" collapse onto the snow/
  // storm families the rows describe.
  snowstorm: ["snow", "snowy", "blizzard", "storm", "ice", "icy", "frozen", "winter"],
  blizzard: ["snow", "snowy", "snowstorm", "storm", "ice", "winter"],
  breathing: ["breathes", "exhaling", "spewing", "belching"],

  // Actions.
  surfing: ["surf", "surfboard", "wave", "riding a wave"],
  riding: ["rides", "mounted", "surfing"],
  flying: ["soaring", "airborne", "wings", "gliding", "flight"],
  // Verb families list plain stems too: the ranker's plural folding does not
  // reach -ing/-s verb forms ("sleeping" vs "sleeps").
  sleeping: ["sleep", "sleeps", "asleep", "napping", "dozing", "resting", "curled up", "lazy"],
  fighting: ["battle", "battling", "clashing", "attacking", "combat"],
  swimming: ["underwater", "diving", "splashing"],
  dancing: ["twirling", "spinning"],
  eating: ["eats", "munching", "feasting", "snacking"],
  running: ["dashing", "sprinting", "racing"],
  laughing: ["grinning", "smiling", "gleeful"],

  // Creature families: bridge everyday nouns to species and type vocabulary.
  ghost: ["spirit", "phantom", "spectral", "ghostly", "haunted", "gastly", "haunter", "gengar", "wisp"],
  dragon: ["draconic", "wyvern", "serpent", "charizard", "dragonite", "dratini", "dragonair"],
  bird: ["avian", "wings", "feathered", "pidgey", "pidgeot", "spearow", "fearow"],
  mouse: ["rodent", "pikachu", "raichu", "rattata"],
  turtle: ["tortoise", "shell", "squirtle", "wartortle", "blastoise"],
  cat: ["feline", "meowth", "persian"],
  dog: ["canine", "growlithe", "arcanine", "hound"],
  snake: ["serpent", "ekans", "arbok", "coiled"],
  fish: ["aquatic", "magikarp", "goldeen", "seaking"],
  butterfly: ["butterfree", "moth", "venomoth", "fluttering"],
  bug: ["insect", "larva", "beetle", "caterpie", "weedle", "kakuna", "metapod", "pinsir"],
  plant: ["flower", "vine", "leafy", "bulbasaur", "oddish", "bellsprout"],
  fairy: ["clefairy", "clefable", "pixie", "whimsical"],
  psychic: ["telekinetic", "mystic", "abra", "kadabra", "alakazam", "mewtwo", "mew"],
  electric: ["lightning", "spark", "sparks", "voltage", "thunderbolt", "pikachu", "electabuzz"],
  fire: ["flame", "flames", "fiery", "burning", "blazing", "ember", "charmander", "charizard"],
  water: ["aquatic", "ocean", "sea", "wave", "splash", "squirtle"],
  ice: ["frozen", "frost", "icy", "glacial", "articuno"],
  rock: ["stone", "boulder", "rocky", "geodude", "onix"],
};
