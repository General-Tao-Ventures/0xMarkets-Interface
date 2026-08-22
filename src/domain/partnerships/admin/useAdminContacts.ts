import { useCallback, useEffect, useState } from "react";

import { usePartnerSession } from "../usePartnerSession";
import type { AdminContact } from "./types";

export type AdminContactMap = Record<string, AdminContact>;

/**
 * Partner contact details, for admin eyes only.
 *
 * Served by an endpoint that re-checks the caller against a SERVER-side allowlist using their
 * signed session — the client-side gate is convenience, this is the actual control. Handles never
 * appear anywhere a partner can see them.
 */
export function useAdminContacts() {
  const session = usePartnerSession();
  const [contacts, setContacts] = useState<AdminContactMap>({});
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session.isSignedIn) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const body = await session.authedFetch<{ contacts: AdminContactMap }>("admin-contacts");
      setContacts(body.contacts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load contacts.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  return { contacts, isLoading, error, session, reload: load };
}
