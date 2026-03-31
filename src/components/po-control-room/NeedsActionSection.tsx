import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { NeedsActionCard, POWorkflowTab } from "./types";

interface Props {
  cards: NeedsActionCard[];
  onViewTab: (tab: POWorkflowTab) => void;
}

export function NeedsActionSection({ cards, onViewTab }: Props) {
  const [open, setOpen] = useState(true);

  if (cards.length === 0) return null;

  const totalCount = cards.reduce((s, c) => s + c.count, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Needs Action Today
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {totalCount}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    card.variant === "destructive"
                      ? "bg-destructive/10 text-destructive"
                      : card.variant === "warning"
                        ? "bg-warning/10 text-warning"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{card.count}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {card.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {card.description}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs mt-1 -ml-2"
                    onClick={() => onViewTab(card.targetTab)}
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
