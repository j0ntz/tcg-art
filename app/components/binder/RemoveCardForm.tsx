import { removeCardFromCollection } from "@/lib/collection/actions";
import { cn } from "@/lib/utils";

interface RemoveCardFormProps {
  cardId: string;
  cardName: string;
  className?: string;
}

// The remove gesture, shared by binder slots and the carousel placard. A plain
// form posting to the server action, so it works before hydration too.
const RemoveCardForm: React.FC<RemoveCardFormProps> = ({ cardId, cardName, className }) => (
  <form action={removeCardFromCollection} className={className}>
    <input type="hidden" name="cardId" value={cardId} />
    <button
      type="submit"
      aria-label={`Remove ${cardName} from binder`}
      data-testid={`remove-${cardId}`}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-pill border border-border-strong",
        "bg-surface/90 text-sm leading-none text-foreground-muted shadow-card",
        "transition-colors hover:bg-surface-hover hover:text-danger",
      )}
    >
      ×
    </button>
  </form>
);

export default RemoveCardForm;
