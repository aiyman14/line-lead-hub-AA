import logoSvg from "@/assets/logo.svg";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gradient-premium">
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        <div className="relative">
          <img 
            src={logoSvg} 
            alt="Production Portal" 
            className="h-20 w-20 animate-pulse-subtle"
          />
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl animate-pulse-subtle" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Production Portal</h1>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
