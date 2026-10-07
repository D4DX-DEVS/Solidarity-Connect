import { Link2, ShieldCheck } from "lucide-react";
import { recordTitle, type AdminAccount } from "./roleUtils";

/** A person with several admin accounts: which one their leader roles are edited on, and that the rest follow it. */
export function AdminAccountsPanel({ accounts }: { accounts: AdminAccount[] }) {
  const manager = accounts.find((a) => a.managesLeaderRoles);
  return (
    <section aria-label="Admin accounts" className="pb-3">
      <p className="text-sm font-semibold">Admin accounts</p>
      <ul className="mt-1.5 divide-y overflow-hidden rounded-lg border bg-card">
        {accounts.map((account) => {
          const places = [account.district?.name, account.group?.name].filter(Boolean).join(" · ");
          const Icon = account.managesLeaderRoles ? ShieldCheck : Link2;
          return (
            <li key={account._id} className="flex items-start gap-2.5 px-3 py-2">
              <Icon
                className={account.managesLeaderRoles ? "mt-0.5 size-4 shrink-0 text-primary" : "mt-0.5 size-4 shrink-0 text-muted-foreground"}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {recordTitle(account)}
                  {places && <span className="font-normal text-muted-foreground"> · {places}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account.managesLeaderRoles
                    ? "Manages leader roles. Changes are synced to their other admin accounts and member record."
                    : manager?.isLeader && !account.isLeader
                      ? "Not listed as a leader — none of their roles is at this account's level."
                      : `Receives synced leader roles from the ${manager ? recordTitle(manager) : "primary"} account.`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
