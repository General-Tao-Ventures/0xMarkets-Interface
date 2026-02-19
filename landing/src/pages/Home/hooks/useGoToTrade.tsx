import { useCallback } from "react";

import type { LandingPageLaunchAppEvent } from "lib/userAnalytics/types";
import { userAnalytics } from "lib/userAnalytics/UserAnalytics";
import { BASE_SEPOLIA } from "sdk/configs/chainIds";

import { useHomePageContext } from "../contexts/HomePageContext";

export enum RedirectChainIds {
  Base,
}

type Props = {
  chainId: RedirectChainIds;
  buttonPosition: LandingPageLaunchAppEvent["data"]["buttonPosition"];
};

const REDIRECT_MAP = {
  [RedirectChainIds.Base]: makeLink(BASE_SEPOLIA),
};

export function useGoToTrade({ buttonPosition, chainId }: Props) {
  const { shouldShowRedirectModal, redirectWithWarning } = useHomePageContext();
  return useCallback(() => {
    userAnalytics.pushEvent<LandingPageLaunchAppEvent>(
      {
        event: "LandingPageAction",
        data: {
          action: "LaunchApp",
          buttonPosition: buttonPosition,
          shouldSeeConfirmationDialog: shouldShowRedirectModal(),
        },
      },
      { instantSend: true }
    );

    const redirectUrl = REDIRECT_MAP[chainId];
    if (redirectUrl) {
      redirectWithWarning(redirectUrl, chainId);
    }
  }, [redirectWithWarning, shouldShowRedirectModal, buttonPosition, chainId]);
}

function makeLink(chainId: number) {
  return `${import.meta.env.VITE_APP_BASE_URL}/trade?${userAnalytics.getSessionForwardParams()}&chainId=${chainId}`;
}
