import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center bg-card p-12 rounded-2xl border border-border shadow-2xl">
        <AlertCircle className="w-16 h-16 text-primary mx-auto mb-6 opacity-80" />
        <h1 className="text-4xl font-bold text-foreground mb-4 font-mono">404</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The page you're looking for has been lost in the void.
        </p>
        <Link href="/">
          <Button variant="glow" size="lg">
            Return to Base
          </Button>
        </Link>
      </div>
    </div>
  );
}
