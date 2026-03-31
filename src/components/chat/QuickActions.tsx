import { HelpCircle, AlertTriangle, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
  language: "en" | "bn" | "zh";
}

const QUICK_ACTIONS = {
  en: [
    {
      icon: HelpCircle,
      label: "How do I...",
      hint: "End-of-day reporting",
      prompt: "How do I submit my end-of-day production report?",
    },
    {
      icon: AlertTriangle,
      label: "Troubleshoot",
      hint: "Form issues & data",
      prompt: "I'm having trouble with the morning targets form. It's not saving my data.",
    },
    {
      icon: Headphones,
      label: "Contact support",
      hint: "Technical help",
      prompt: "How can I contact support for help with a technical issue?",
    },
  ],
  bn: [
    {
      icon: HelpCircle,
      label: "কিভাবে করব...",
      hint: "রিপোর্ট জমা",
      prompt: "আমি কিভাবে দিনের শেষে প্রোডাকশন রিপোর্ট জমা দেব?",
    },
    {
      icon: AlertTriangle,
      label: "সমস্যা সমাধান",
      hint: "ফর্ম ও ডাটা",
      prompt: "সকালের টার্গেট ফর্মে সমস্যা হচ্ছে। ডাটা সেভ হচ্ছে না।",
    },
    {
      icon: Headphones,
      label: "সাপোর্ট",
      hint: "টেকনিক্যাল সাহায্য",
      prompt: "টেকনিক্যাল সমস্যার জন্য সাপোর্টের সাথে কিভাবে যোগাযোগ করব?",
    },
  ],
  zh: [
    {
      icon: HelpCircle,
      label: "如何操作...",
      hint: "日终报告",
      prompt: "我如何提交日终生产报告？",
    },
    {
      icon: AlertTriangle,
      label: "故障排除",
      hint: "表单与数据问题",
      prompt: "早间目标表单出了问题，数据无法保存。",
    },
    {
      icon: Headphones,
      label: "联系支持",
      hint: "技术帮助",
      prompt: "如何联系技术支持解决技术问题？",
    },
  ],
};

export function QuickActions({ onSelect, language }: QuickActionsProps) {
  const actions = QUICK_ACTIONS[language];
  const isOddCount = actions.length % 2 !== 0;

  return (
    <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
      {actions.map((action, index) => {
        const isLastOdd = isOddCount && index === actions.length - 1;
        return (
          <button
            key={index}
            onClick={() => onSelect(action.prompt)}
            className={cn(
              "group flex flex-col items-start gap-2 p-3 rounded-xl border bg-card text-left",
              "shadow-sm hover:shadow-md hover:border-primary/30",
              "transition-all duration-200 hover:-translate-y-0.5",
              "animate-in fade-in slide-in-from-bottom-2",
              isLastOdd && "col-span-2 justify-self-center max-w-[calc(50%-0.3125rem)]"
            )}
            style={{
              animationDelay: `${index * 75}ms`,
              animationFillMode: "both",
              animationDuration: "400ms",
            }}
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors duration-200">
              <action.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground leading-tight">
                {action.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {action.hint}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
