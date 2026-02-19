import { BASE_SEPOLIA } from "sdk/configs/chainIds";
import useUsers from "domain/synthetics/stats/useUsers";
import { sumBigInts } from "lib/sumBigInts";

export function useTraders(): number | null {
  const baseSepoliaUsers = useUsers(BASE_SEPOLIA);
  return Number(
    sumBigInts(
      baseSepoliaUsers?.totalUsers
    )
  );
}
