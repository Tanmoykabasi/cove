import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/chat-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-dvh bg-bg">
        <aside className="hidden w-72 border-r border-border bg-surface md:block" />
        <main className="flex flex-1 items-center justify-center">
          <p className="font-display text-2xl tracking-tight text-muted">Cove</p>
        </main>
      </div>
    );
  }

  return <ChatApp />;
}
