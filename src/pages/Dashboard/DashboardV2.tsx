import { t } from "@lingui/macro";

import { SyntheticsStateContextProvider } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { getPageTitle } from "lib/legacy";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import { MarketsList } from "components/MarketsList/MarketsList";
import PageTitle from "components/PageTitle/PageTitle";
import SEO from "components/Seo/SEO";

import { PlatformStats } from "./PlatformStats";

import "./DashboardV2.css";

export default function DashboardV2() {
  return (
    <SEO title={getPageTitle(t`Stats`)}>
      <AppPageLayout header={<ChainContentHeader />}>
        <div className="default-container DashboardV2 page-layout flex flex-col gap-28">
          <PageTitle title={t`Stats`} qa="dashboard-page" />

          <PlatformStats />

          <SyntheticsStateContextProvider skipLocalReferralCode={false} pageType="pools">
            <MarketsList />
          </SyntheticsStateContextProvider>
        </div>
      </AppPageLayout>
    </SEO>
  );
}
