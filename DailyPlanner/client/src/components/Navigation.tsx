import { Link, useLocation } from "wouter";
import { Book, LayoutDashboard, Calendar, PenTool, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Journal", icon: Book },
    { href: "/weekly", label: "Weekly", icon: Calendar },
    { href: "/dashboard", label: "Insights", icon: LayoutDashboard },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:left-0 md:right-auto md:w-24 md:h-screen bg-card border-t md:border-t-0 md:border-r border-border z-40 flex md:flex-col items-center justify-around md:justify-start md:pt-12 md:gap-8 p-4 shadow-lg md:shadow-none">
      <div className="hidden md:flex flex-col items-center gap-2 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
          <span className="font-serif font-bold text-2xl italic">D</span>
        </div>
      </div>

      {links.map((link) => {
        const isActive = location === link.href;
        return (
          <Link 
            key={link.href} 
            href={link.href}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300 group",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-primary/70"
            )}
          >
            <div className={cn(
              "p-2 rounded-full transition-all duration-300",
              isActive ? "bg-primary/10 shadow-sm" : "group-hover:bg-primary/5"
            )}>
              <link.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <span className={cn(
              "text-[10px] font-sans uppercase tracking-widest font-medium",
              isActive ? "opacity-100" : "opacity-0 md:opacity-100 md:text-[0px] md:group-hover:text-[10px] transition-all"
            )}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
