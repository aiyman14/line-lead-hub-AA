import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Link2, AlertTriangle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  workOrderId: string;
  poNumber: string;
  onViewExtras?: () => void;
}

export function POQuickActions({ workOrderId, poNumber, onViewExtras }: Props) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate("/setup/work-orders")}>
          <Link2 className="h-4 w-4 mr-2" />
          Assign Line
        </DropdownMenuItem>
        {onViewExtras && (
          <DropdownMenuItem onClick={onViewExtras}>
            <Archive className="h-4 w-4 mr-2" />
            Extras Ledger
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            navigate(
              `/report-blocker?work_order_id=${encodeURIComponent(workOrderId)}`
            )
          }
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Report Blocker
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
