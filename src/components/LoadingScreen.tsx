import logoSvg from "@/assets/logo.svg";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#004aad]">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <img 
          src={logoSvg} 
          alt="Production Portal" 
          className="h-24 w-24 animate-pulse"
        />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Production Portal</h1>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:0ms]" />
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:150ms]" />
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
