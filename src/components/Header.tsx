import { Search, Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export const Header = () => {
  return (
    <header className="border-b border-border/50 bg-card backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-8 py-3.5">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-background"></div>
            </div>
          </div>
          
          <nav className="flex items-center gap-8">
            <a href="#" className="text-primary font-medium text-sm relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary">Home</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-all text-sm">Settings</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-all text-sm">Help</a>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search Reports" 
              className="pl-10 w-64 bg-background border-border"
            />
          </div>
          
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">Jessica Lofez</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <Avatar>
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica" />
              <AvatarFallback>JL</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
};
