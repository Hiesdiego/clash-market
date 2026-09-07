// The authenticated app: Squad Builder, league tables, Live Wall (logged-in
// view), etc. Navigation now lives in the shared AppShell (root layout); this
// layout only supplies the ambient background for authenticated surfaces.

//Tom O.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[radial-gradient(circle_at_70%_-10%,#123024_0%,#07110d_45%)]">
      {children}
    </div>
  );
}
