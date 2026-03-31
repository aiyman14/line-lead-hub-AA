import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LanguageToggleProps {
  language: "en" | "bn" | "zh";
  onToggle: (lang: "en" | "bn" | "zh") => void;
}

const LANGUAGES = [
  { code: "en" as const, label: "English", flag: "🇬🇧" },
  { code: "bn" as const, label: "বাংলা", flag: "🇧🇩" },
  { code: "zh" as const, label: "中文", flag: "🇨🇳" },
];

export function LanguageToggle({ language, onToggle }: LanguageToggleProps) {
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-2.5 text-xs gap-1.5 rounded-full hover:bg-muted">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{currentLang.flag}</span>
          <span className="font-medium">{currentLang.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => onToggle(lang.code)}
            className="gap-2"
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
