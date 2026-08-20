import { Trans, t } from "@lingui/macro";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePartnerCodes } from "domain/partnerships";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";

import { Calculator } from "./Calculator";
import { Card } from "./components";
import { Ladder } from "./Ladder";
import { REACH_OUT } from "./tierLadder";

const DISCORD_URL = "https://discord.gg/0xmarkets";

/**
 * The public pitch. Reachable without a wallet — this is the page a partner is sent, so it must
 * stand on its own and never assume a connection.
 */
export default function PartnershipsJoin() {
  const { chainId } = useChainId();
  const { account } = useWallet();
  const { isPartner } = usePartnerCodes(chainId, account);

  return (
    <AppPageLayout contentClassName="max-w-[1100px] gap-32 pb-32">
      {/* ---------------- hero ---------------- */}
      <section className="pt-16">
        <span className="text-12 uppercase tracking-wider text-blue-300">
          <Trans>Partnership programme</Trans>
        </span>
        <h1 className="leading-tight text-34 mt-8 max-w-[18ch] font-medium md:text-[44px]">
          <Trans>
            Introduce traders. Earn up to <span className="text-blue-300">60%</span> of every fee they pay.
          </Trans>
        </h1>
        <p className="mt-12 max-w-[60ch] text-15 text-slate-100">
          <Trans>
            Start on <b className="text-white">20%</b> from your first trade — no approval, no minimums. Commission is
            paid on-chain, on every fill.
          </Trans>
        </p>

        <div className="mt-20 flex flex-wrap items-center gap-12">
          <Link to={isPartner ? "/partnerships" : "/partnerships/start"}>
            <Button variant="primary-action">
              {isPartner ? <Trans>Go to your portal</Trans> : <Trans>Become a partner</Trans>}
            </Button>
          </Link>
          <a href="#ladder">
            <Button variant="secondary">
              <Trans>See the commission ladder</Trans>
            </Button>
          </a>
          <span className="text-12 text-slate-100">
            <Trans>Takes about two minutes.</Trans>
          </span>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-8 lg:grid-cols-4">
          <Highlight k={t`Up to 60%`} l={t`At the top of the book, agreed case by case`} />
          <Highlight k={t`Every trade`} l={t`Commission accrues per fill, not per month`} />
          <Highlight k={t`Claim anytime`} l={t`No minimum, no schedule, settles on Base`} />
          <Highlight k={t`20% to start`} l={t`Day one, no volume, no approval`} />
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section>
        <Heading>
          <Trans>How it works</Trans>
        </Heading>
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3">
          <Step n={1} title={t`Share your link`}>
            <Trans>One code per channel you run, each with its own reporting.</Trans>
          </Step>
          <Step n={2} title={t`They connect and trade`}>
            <Trans>Your trader connects a wallet and is attached to you permanently. No forms.</Trans>
          </Step>
          <Step n={3} title={t`You earn on every fill`}>
            <Trans>Your share lands in your claimable balance as each trade settles. Claim anytime.</Trans>
          </Step>
        </div>
      </section>

      {/* ---------------- calculator ---------------- */}
      <section>
        <Heading sub={t`Set the monthly volume you can introduce. Calculated at a blended 0.025% trading fee.`}>
          <Trans>What a book is worth here</Trans>
        </Heading>
        <div className="mt-16">
          <Calculator />
        </div>
      </section>

      {/* ---------------- ladder ---------------- */}
      <section id="ladder">
        <Heading
          sub={t`Start at Operator on 20%. Climb on volume and funded referrals — both, not either. The top two tiers are agreed case by case.`}
        >
          <Trans>The Operators</Trans>
        </Heading>
        <Card className="mt-16">
          {/* -1 so no rung is marked YOU: this page is read logged out as often as not. */}
          <Ladder currentIndex={-1} />
          <div className="mt-16 flex flex-wrap items-center gap-12 border-t border-slate-700 pt-16 text-12 text-slate-100">
            <span className="rounded-full bg-green-500/15 px-10 py-4 text-green-500">
              <Trans>Tier held 60 days</Trans>
            </span>
            <span>
              <Trans>
                Reach a tier and you keep its rate for at least <b className="text-white">60 days</b>, even if volume
                dips.
              </Trans>
            </span>
          </div>
        </Card>
      </section>

      {/* ---------------- payout ---------------- */}
      <section>
        <Heading>
          <Trans>How you get paid</Trans>
        </Heading>
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3">
          <Bucket label={t`When`} value={t`On every fill`}>
            <Trans>Credited as the trade settles — not batched, not monthly.</Trans>
          </Bucket>
          <Bucket label={t`Control`} value={t`You claim it`}>
            <Trans>No minimum, no payout window. One button.</Trans>
          </Bucket>
          <Bucket label={t`Where`} value={t`Your wallet, on Base`}>
            <Trans>Settled in the collateral token.</Trans>
          </Bucket>
        </div>
        <p className="mt-12 text-12 text-slate-100">
          <Trans>
            Your commission comes out of the venue's share of the fee.{" "}
            <b className="text-white">Your traders do not pay more for using your link.</b>
          </Trans>
        </p>
      </section>

      {/* ---------------- desk CTA ---------------- */}
      <Card className="flex flex-wrap items-center justify-between gap-16">
        <div>
          <h3 className="text-18 font-medium">
            <Trans>
              Running {REACH_OUT.volume} a month with {REACH_OUT.referrals} funded referrals?
            </Trans>
          </h3>
          <p className="mt-4 text-13 text-slate-100">
            <Trans>
              Rates up to <b className="text-white">{REACH_OUT.maxRate}%</b>, agreed case by case.
            </Trans>
          </p>
        </div>
        <ExternalLink href={DISCORD_URL}>
          <Button variant="secondary">
            <Trans>Reach out on Discord</Trans>
          </Button>
        </ExternalLink>
      </Card>

      {/* ---------------- FAQ ---------------- */}
      <section>
        <Heading>
          <Trans>Questions</Trans>
        </Heading>
        <div className="mt-16 flex flex-col gap-8">
          <Faq open q={t`What do I need to start?`}>
            <Trans>
              A wallet, your name and one verified contact channel — Discord, Telegram or email. No application, no
              review, no minimum book.
            </Trans>
          </Faq>
          <Faq q={t`Why do you need my contact details?`}>
            <Trans>
              We pay you and occasionally need to reach you. Details are never written on-chain, never shown to your
              traders, never published — only a yes/no verified flag is public.
            </Trans>
          </Faq>
          <Faq q={t`When and how do I get paid?`}>
            <Trans>
              Credited to your claimable balance on every trade your referrals make. Claim anytime, settles to your
              wallet on Base in the collateral token.
            </Trans>
          </Faq>
          <Faq q={t`Do my traders pay more because they used my link?`}>
            <Trans>No. They pay the same fee as everyone else — your commission comes out of the venue's share.</Trans>
          </Faq>
          <Faq q={t`How do I move up a tier?`}>
            <Trans>
              30-day volume and funded referrals — both, per the ladder above. The referral count exists so the volume
              comes from real traders, not one wallet trading in circles. Once you hit a tier you keep the rate for at
              least 60 days.
            </Trans>
          </Faq>
          <Faq q={t`What about the top two tiers?`}>
            <Trans>
              Kingmaker and Sovereign are agreed case by case. If you run $100m+ a month with 50+ funded referrals,
              reach out on Discord.
            </Trans>
          </Faq>
          <Faq q={t`Can I refer myself?`}>
            <Trans>No — rejected at the contract level. Your own trading earns you nothing.</Trans>
          </Faq>
          <Faq q={t`Can I run more than one code?`}>
            <Trans>
              As many as you want, each with a private label and its own reporting. All codes roll up into one tier.
            </Trans>
          </Faq>
          <Faq q={t`Who is not eligible?`}>
            <Trans>
              Residents of restricted jurisdictions, and promotion to them. The partner terms list the excluded
              territories and marketing rules — you are responsible for where you promote your link.
            </Trans>
          </Faq>
        </div>
      </section>

      {/* ---------------- end CTA ---------------- */}
      <section className="rounded-4 bg-slate-800 p-32 text-center">
        <h2 className="text-24 font-medium">
          <Trans>Start at Operator in two minutes</Trans>
        </h2>
        <p className="mt-8 text-14 text-slate-100">
          <Trans>Connect a wallet, confirm your contact details, create your code. That's it.</Trans>
        </p>
        <div className="mt-20 flex justify-center">
          <Link to={isPartner ? "/partnerships" : "/partnerships/start"}>
            <Button variant="primary-action">
              {isPartner ? <Trans>Go to your portal</Trans> : <Trans>Become a partner</Trans>}
            </Button>
          </Link>
        </div>

        <p className="leading-relaxed mx-auto mt-24 max-w-[80ch] text-left text-11 text-slate-100">
          <Trans>
            <b>Illustrative figures.</b> All commission examples on this page assume a blended trading fee of 0.025% and
            are estimates, not a projection of earnings. Actual commission depends on the markets your traders use, the
            balance of their flow and the volume they trade. Tier rates and requirements are set by governance and can
            change.
          </Trans>
          <br />
          <br />
          <Trans>
            <b>Eligibility.</b> Trading leveraged derivatives carries significant risk. This programme is not available
            to, and must not be promoted to, residents of restricted jurisdictions. Partners are a regulated category in
            many territories and you are responsible for your own licensing, disclosures and marketing conduct. Nothing
            here is an offer, an inducement or investment advice.
          </Trans>
        </p>
      </section>
    </AppPageLayout>
  );
}

function Heading({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <h2 className="text-24 font-medium">{children}</h2>
      {sub ? <p className="mt-8 max-w-[70ch] text-13 text-slate-100">{sub}</p> : null}
    </div>
  );
}

function Highlight({ k, l }: { k: string; l: string }) {
  return (
    <div className="rounded-4 bg-slate-800 p-16">
      <div className="text-16 font-medium">{k}</div>
      <div className="leading-snug mt-4 text-12 text-slate-100">{l}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="rounded-4 bg-slate-800 p-16">
      <div className="flex size-24 items-center justify-center rounded-full bg-blue-300 text-12 font-medium text-slate-900">
        {n}
      </div>
      <h3 className="mt-12 text-15 font-medium">{title}</h3>
      <p className="mt-4 text-13 text-slate-100">{children}</p>
    </div>
  );
}

function Bucket({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="rounded-4 bg-slate-800 p-16">
      <div className="text-12 text-slate-100">{label}</div>
      <div className="text-17 mt-4 font-medium">{value}</div>
      <div className="mt-4 text-13 text-slate-100">{children}</div>
    </div>
  );
}

function Faq({ q, children, open }: { q: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="rounded-4 bg-slate-800 px-16 py-12" open={open}>
      <summary className="cursor-pointer list-none text-14 font-medium">{q}</summary>
      <div className="leading-relaxed mt-8 max-w-[80ch] text-13 text-slate-100">{children}</div>
    </details>
  );
}
