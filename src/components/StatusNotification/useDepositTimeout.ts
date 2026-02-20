import { useEffect, useState } from "react";

export function useDepositElapsed(createdAt: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (createdAt === undefined) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.floor((Date.now() - createdAt) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - createdAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  return elapsed;
}
