import { Topbar } from "@/components/Topbar";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = (await requireUser())!;
  return (
    <>
      <Topbar title="Settings" subtitle="Account & preferences" />
      <main className="flex-1 overflow-auto p-6">
        <div className="card-pad max-w-xl">
          <h3 className="font-semibold mb-4">Account</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Name</dt>
              <dd>{user.name ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </main>
    </>
  );
}
