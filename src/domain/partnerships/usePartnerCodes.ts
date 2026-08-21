import { gql } from "@apollo/client";
import type { Hex } from "viem";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";

const CODES_QUERY = gql`
  query ownedCodes($owner: String!) {
    referralCodes(where: { owner_eq: $owner }, orderBy: registeredAt_ASC) {
      code
      registeredAt
    }
  }
`;

/**
 * Codes this wallet owns, from the indexer. This is what decides "already a partner".
 *
 * It is complete rather than best-effort: ReferralStorage was deployed at block 49,359,871 and the
 * indexer starts at 49,359,429, so no code can predate what it has seen.
 */
export function usePartnerCodes(chainId: number, account: string | undefined) {
  const client = getSubsquidGraphClient(chainId);
  const owner = account?.toLowerCase();

  const { data, isLoading, mutate } = useSWR<Hex[]>(
    owner && client ? ["partner-owned-codes", chainId, owner] : null,
    async () => {
      const res = await client!.query({
        query: CODES_QUERY,
        variables: { owner },
        fetchPolicy: "no-cache",
      });
      return (res.data?.referralCodes ?? []).map((c: any) => c.code as Hex);
    },
    { revalidateOnFocus: false }
  );

  return { codes: data ?? [], isPartner: (data?.length ?? 0) > 0, isLoading, refresh: mutate };
}
