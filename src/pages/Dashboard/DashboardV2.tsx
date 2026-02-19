import { Trans, t } from "@lingui/macro";
import { Link } from "react-router-dom";

import { SyntheticsStateContextProvider } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useChainId } from "lib/chains";
import { getPageTitle } from "lib/legacy";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import { MarketsList } from "components/MarketsList/MarketsList";
import PageTitle from "components/PageTitle/PageTitle";
import SEO from "components/Seo/SEO";

import V2Icon from "img/ic_v2.svg?react";

import { GmCard } from "./GmCard";

import "./DashboardV2.css";

export default function DashboardV2() {
  const { chainId } = useChainId();

  return (
    <SEO title={getPageTitle(t`Stats`)}>
      <AppPageLayout header={<ChainContentHeader />}>
        <div className="default-container DashboardV2 page-layout flex flex-col gap-20">
          <PageTitle
            title={t`Total Stats`}
            qa="dashboard-page"
            subtitle={
              <div className="flex items-center gap-6 font-medium text-typography-secondary">
                <Trans>For detailed stats</Trans>{" "}
                <Link
                  className="flex items-center gap-4 text-typography-secondary !no-underline hover:text-typography-primary"
                  to="/monitor"
                >
                  <V2Icon className="size-15" /> Pools Stats
                </Link>
              </div>
            }
          />
          <div className="flex flex-col gap-20">
            <h2 className="text-h2 px-12 font-medium">{t`Markets`}</h2>
            <div className="DashboardV2-token-cards">
              <div className="stats-wrapper stats-wrapper--gmx">
                <GmCard />
              </div>

              <SyntheticsStateContextProvider skipLocalReferralCode={false} pageType="pools">
                <MarketsList />
              </SyntheticsStateContextProvider>
            </div>
          </div>
        </div>
      </AppPageLayout>
    </SEO>
  );
}
