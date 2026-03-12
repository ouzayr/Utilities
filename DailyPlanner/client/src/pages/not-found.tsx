import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-9xl font-serif text-primary/20 mb-4">404</h1>
      <h2 className="text-2xl font-serif text-primary mb-6">Page Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-md font-sans">
        The page you are looking for seems to have been torn out of the diary.
      </p>
      
      <Link href="/">
        <Button className="gap-2">
          <Home className="w-4 h-4" />
          Return Home
        </Button>
      </Link>
    </div>
  );
}
