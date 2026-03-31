import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { POViewTab } from "./types";

const TABS: { value: POViewTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "at_risk", label: "At Risk" },
  { value: "ex_factory_soon", label: "Ex-Factory Soon" },
  { value: "no_line", label: "No Line" },
  { value: "updated_today", label: "Updated Today" },
  { value: "on_target", label: "On Target" },
];

interface Props {
  activeTab: POViewTab;
  onTabChange: (tab: POViewTab) => void;
  counts: Record<POViewTab, number>;
}

export function POFilterTabs({ activeTab, onTabChange, counts }: Props) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as POViewTab)}
    >
      <TabsList className="flex-wrap h-auto gap-1">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
            {tab.label}
            {counts[tab.value] > 0 && (
              <Badge
                variant={
                  tab.value === "at_risk"
                    ? "destructive"
                    : tab.value === "on_target"
                      ? "success"
                      : "secondary"
                }
                className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] justify-center"
              >
                {counts[tab.value]}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
