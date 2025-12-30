import type React from "react";
import { Container } from "@/components/ui/container";
import { Brand } from "@/components/shell/brand";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { MobileNav } from "@/components/shell/mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <Brand />

          <div className="hidden items-center gap-6 text-sm font-medium text-fg/80 md:flex">
            <a className="hover:text-fg" href="/about">
              About
            </a>
            <a className="hover:text-fg" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-fg" href="/terms">
              Terms
            </a>
          </div>

          <div className="md:hidden">
            <MobileNav triggerLabel="Menu">
              <SidebarNav />
            </MobileNav>
          </div>
        </Container>
      </header>

      <Container className="grid grid-cols-1 gap-8 py-8 md:grid-cols-[260px_1fr]">
        <aside className="sticky top-24 hidden h-[calc(100dvh-120px)] overflow-auto rounded-xl border border-border bg-panel p-5 md:block">
          <SidebarNav />
        </aside>

        <main className="min-w-0">{children}</main>
      </Container>

      <footer className="border-t border-border py-10">
        <Container className="flex flex-col gap-3 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} SecWeave</div>
          <div className="flex gap-4">
            <a className="hover:text-fg" href="/contact">
              Contact
            </a>
            <a className="hover:text-fg" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-fg" href="/terms">
              Terms
            </a>
          </div>
        </Container>
      </footer>
    </div>
  );
}
