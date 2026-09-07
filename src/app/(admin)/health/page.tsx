import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function HealthPage() {
  const admin = createSupabaseAdminClient();
  const { data: jobs, error } = await admin.from("worker_health").select("*").order("job_name");

  if (error) {
    return <main className="p-8 text-loss">Failed to load worker health: {error.message}</main>;
  }

  return (
    <main className="p-8">
      <h1 className="font-display text-2xl text-chalk-100">Worker health</h1>
      {(!jobs || jobs.length === 0) && (
        <p className="mt-2 text-sm text-chalk-500">
          No rows yet — the worker hasn&apos;t reported in. See worker/README.md.
        </p>
      )}
      <div className="mt-4 space-y-2">
        {jobs?.map((job) => {
          const lagMinutes = job.last_success_at
            ? Math.round((Date.now() - new Date(job.last_success_at).getTime()) / 60000)
            : null;
          const stale = lagMinutes === null || lagMinutes > 15 || job.consecutive_failures > 0;
          return (
            <div
              key={job.job_name}
              className={`rounded-card border p-3 ${stale ? "border-loss/40 bg-loss/5" : "border-chalk-800 bg-pitch-900"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-chalk-100">{job.job_name}</span>
                <span className={`text-xs ${stale ? "text-loss" : "text-gain"}`}>
                  {lagMinutes !== null ? `${lagMinutes}m ago` : "never succeeded"}
                </span>
              </div>
              {job.consecutive_failures > 0 && (
                <p className="mt-1 text-xs text-loss">
                  {job.consecutive_failures} consecutive failures — {job.last_error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
