import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import cx from "classnames";
import { useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { useCopyToClipboard } from "react-use";

import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import { useLocalPartnerCodes, usePartnerCodes, usePartnerSession, usePartnerStatus } from "domain/partnerships";
import { registerReferralCode } from "domain/referrals";
import { decodeReferralCode } from "sdk/utils/referrals";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import useWallet from "lib/wallets/useWallet";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { getReferralCodeTradeUrl } from "components/Referrals/referralsHelper";

import { TelegramLoginButton } from "./TelegramLoginButton";
import { Card } from "./components";

const CODE_PATTERN = /^[A-Za-z0-9_]{1,20}$/;
/** Must match the bot whose domain is bound with BotFather /setdomain. */
const TELEGRAM_BOT = import.meta.env.VITE_TELEGRAM_BOT ?? "oxmarkets_partnerships_bot";
const STEPS = [
  { key: "wallet", label: <Trans>Wallet</Trans> },
  { key: "contact", label: <Trans>Contact</Trans> },
  { key: "code", label: <Trans>Code</Trans> },
];

/**
 * Becoming a partner, in three steps.
 *
 * The step is derived from what is actually true — connected, verified, has a code — rather than
 * held in a counter. Reload halfway through and you resume where you were, and someone who already
 * verified their contact months ago never sees that step again.
 */
export default function PartnershipsStart() {
  const { chainId } = useChainId();
  const { account, signer } = useWallet();
  const { openConnectModal } = useConnectModal();
  const history = useHistory();

  const session = usePartnerSession();
  const { codes, refresh: refreshCodes } = usePartnerCodes(chainId, account);
  const { localCodes, remember } = useLocalPartnerCodes(chainId, account);

  const [createdCode, setCreatedCode] = useState<string | undefined>();
  // The indexer returns bytes32; localCodes are already plain text. Decoding here stops a raw
  // 0x47554c46… ending up in the share link on the done screen.
  const existingCode = codes[0] ? decodeReferralCode(codes[0] as `0x${string}`) : localCodes[0];

  const step = !account ? 0 : !session.contact?.verified ? 1 : 2;
  const done = Boolean(createdCode ?? existingCode);

  // Someone who is already a partner should not be walked through sign-up. Keyed on the resolved
  // status, not on an empty-but-unloaded code list, so this cannot fire on a half-known answer.
  const { status } = usePartnerStatus(account);
  useEffect(() => {
    if (!createdCode && status === "partner") history.replace("/partnerships");
  }, [status, createdCode, history]);

  return (
    <AppPageLayout>
      {/* Narrow on purpose: one decision per step, nothing else competing for attention. */}
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-16 pb-32">
        {!done && (
          <ol className="flex items-center gap-8 pt-16">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-1 items-center gap-8">
                <span
                  className={cx(
                    "flex size-24 shrink-0 items-center justify-center rounded-full text-12 font-medium",
                    i < step && "bg-green-500 text-slate-900",
                    i === step && "bg-blue-300 text-slate-900",
                    i > step && "bg-slate-700 text-slate-100"
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span className={cx("text-13", i === step ? "text-white" : "text-slate-100")}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <span className={cx("h-1 flex-1 rounded-full", i < step ? "bg-green-500" : "bg-slate-700")} />
                )}
              </li>
            ))}
          </ol>
        )}

        {done ? (
          <DoneStep code={(createdCode ?? existingCode)!} />
        ) : step === 0 ? (
          <WalletStep onConnect={openConnectModal} />
        ) : step === 1 ? (
          <ContactStep session={session} />
        ) : (
          <CodeStep
            onCreated={(code) => {
              remember(code);
              setCreatedCode(code);
              void refreshCodes();
            }}
            canSubmit={Boolean(account && signer)}
          />
        )}

        <p className="text-center text-12 text-slate-100">
          <Trans>
            Stuck? <ExternalLink href="https://discord.gg/0xmarkets">Ask in the 0xMarkets Discord.</ExternalLink>
          </Trans>
        </p>
      </div>
    </AppPageLayout>
  );
}

function StepCard({
  title,
  lede,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-24">
      <h1 className="text-24 font-medium">{title}</h1>
      {lede ? <p className="mt-8 text-13 text-slate-100">{lede}</p> : null}
      <div className="mt-20">{children}</div>
    </Card>
  );
}

function WalletStep({ onConnect }: { onConnect?: () => void }) {
  return (
    <StepCard
      title={<Trans>Connect your wallet</Trans>}
      lede={
        <Trans>
          This address is your partner account — codes, tier and commission are all tied to it, permanently.
        </Trans>
      }
    >
      <Button variant="primary-action" onClick={onConnect}>
        <Trans>Connect wallet</Trans>
      </Button>
      <p className="mt-16 text-12 text-slate-100">
        <Trans>
          Not sure yet?{" "}
          <Link to="/partnerships/join" className="text-blue-300">
            Read how the programme works
          </Link>{" "}
          — what you earn, when you get paid and how the tiers work.
        </Trans>
      </p>
    </StepCard>
  );
}

/**
 * Email is deliberately absent: it is disabled server-side too (PARTNER_EMAIL_ENABLED). Offering a
 * channel the API will refuse is worse than not offering it. Both one-click channels remain.
 */
const CHANNELS = [
  {
    key: "telegram" as const,
    name: <Trans>Telegram</Trans>,
    hint: <Trans>One click</Trans>,
    placeholder: "@yourhandle",
  },
  { key: "discord" as const, name: <Trans>Discord</Trans>, hint: <Trans>One click</Trans>, placeholder: "yourhandle" },
];

function ContactStep({ session }: { session: ReturnType<typeof usePartnerSession> }) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "telegram" | "discord">("telegram");
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ instruction: string | null; devCode: string | null } | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (session.contact?.name && !name) setName(session.contact.name);
    // Prefilling once from the server is the point; re-running on every keystroke is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.contact?.name]);

  const placeholder = useMemo(() => CHANNELS.find((c) => c.key === channel)!.placeholder, [channel]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t`Something went wrong. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  if (!session.isSignedIn) {
    return (
      <StepCard
        title={<Trans>Confirm it's you</Trans>}
        lede={
          <Trans>
            Sign a message with your wallet so we know these contact details belong to you. It is free, it is not a
            transaction, and it moves no funds.
          </Trans>
        }
      >
        <Button variant="primary-action" disabled={session.isLoading} onClick={() => void session.signIn()}>
          {session.isLoading ? <Trans>Check your wallet…</Trans> : <Trans>Sign in with wallet</Trans>}
        </Button>
        {session.error && <p className="mt-12 text-12 text-red-500">{session.error}</p>}
      </StepCard>
    );
  }

  return (
    <StepCard
      title={<Trans>Confirm your contact details</Trans>}
      lede={<Trans>We pay you, so we need to be able to reach you. Never on-chain, never shown to your traders.</Trans>}
    >
      <label className="text-12 text-slate-100" htmlFor="pt-name">
        <Trans>Your name</Trans>
      </label>
      <div className="mt-4 flex gap-8">
        <input
          id="pt-name"
          className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13 outline-none"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy || name.trim().length < 2 || name.trim() === session.contact?.name}
          onClick={() => void run(() => session.saveName(name))}
        >
          <Trans>Save</Trans>
        </Button>
      </div>

      <div className="mt-20 text-12 text-slate-100">
        <Trans>Verify one channel</Trans>
      </div>
      <div className="mt-8 flex flex-wrap gap-8">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={cx(
              "rounded-4 border px-12 py-8 text-left text-13",
              channel === c.key ? "border-blue-300 bg-slate-700" : "border-slate-700 bg-slate-800"
            )}
            onClick={() => {
              setChannel(c.key);
              setChallenge(undefined);
              setError(undefined);
            }}
          >
            <div>{c.name}</div>
            <div className="text-11 text-slate-100">{c.hint}</div>
          </button>
        ))}
      </div>

      {channel === "telegram" ? (
        <div className="mt-12">
          <p className="text-12 text-slate-100">
            <Trans>
              One click — Telegram confirms it's you and sends us your username. We never see your messages, your
              contacts or your phone number.
            </Trans>
          </p>
          <div className="mt-12">
            <TelegramLoginButton
              botUsername={TELEGRAM_BOT}
              onAuth={(payload) => void run(() => session.telegramLogin(payload))}
            />
          </div>
        </div>
      ) : channel === "discord" ? (
        <div className="mt-12">
          <p className="text-12 text-slate-100">
            <Trans>
              You'll be sent to Discord to authorise, then straight back here. We only ask for your username — not your
              email, servers or messages.
            </Trans>
          </p>
          <div className="mt-12">
            <Button
              variant="primary-action"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { url } = await session.startDiscord();
                  window.location.href = url;
                })
              }
            >
              <Trans>Continue with Discord</Trans>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-12 flex gap-8">
            <input
              className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13 outline-none"
              placeholder={placeholder}
              spellCheck={false}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={busy || handle.trim().length < 3}
              onClick={() =>
                void run(async () => {
                  const started = await session.startVerification(channel, handle);
                  setChallenge({ instruction: started.instruction, devCode: started.devCode });
                })
              }
            >
              <Trans>Send code</Trans>
            </Button>
          </div>

          {challenge && (
            <div className="mt-12 rounded-4 bg-slate-700/50 p-12 text-12">
              {challenge.instruction ? (
                <div className="font-mono text-13">{challenge.instruction}</div>
              ) : (
                <Trans>We sent a six-digit code to {handle}. It expires in 15 minutes.</Trans>
              )}
              {challenge.devCode && (
                <div className="mt-8 text-11 text-yellow-500">
                  <Trans>Local development: the code is {challenge.devCode}</Trans>
                </div>
              )}
              {/* Telegram is redeemed by the bot, so there is nothing to type here. Email is. */}
              <div className="mt-12 flex gap-8">
                <input
                  className="w-full rounded-4 bg-slate-700 px-12 py-10 font-mono text-13 outline-none"
                  placeholder="000000"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  variant="primary-action"
                  disabled={busy || !code.trim()}
                  onClick={() => void run(() => session.verify(code))}
                >
                  <Trans>Verify</Trans>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-12 text-12 text-red-500">{error}</p>}

      <p className="mt-16 text-11 text-slate-100">
        <Trans>
          Your details are stored off-chain and returned only to this wallet. The rest of the product sees a yes/no
          verified flag and nothing else.
        </Trans>
      </p>
    </StepCard>
  );
}

function CodeStep({ onCreated, canSubmit }: { onCreated: (code: string) => void; canSubmit: boolean }) {
  const { chainId } = useChainId();
  const { signer } = useWallet();
  const { pendingTxns } = usePendingTxns();

  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = CODE_PATTERN.test(code);

  return (
    <StepCard title={<Trans>Create your code</Trans>}>
      <label className="text-12 text-slate-100" htmlFor="pt-start-code">
        <Trans>Code</Trans>
      </label>
      <input
        id="pt-start-code"
        className="mt-4 w-full rounded-4 bg-slate-700 px-12 py-10 font-mono text-13 outline-none"
        placeholder="gulf_signals"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div className="mt-4 text-11 text-slate-100">
        <Trans>Letters, numbers, underscores. Permanent, on-chain, yours.</Trans>
      </div>

      {valid && (
        <>
          <div className="mt-16 text-12 text-slate-100">
            <Trans>Your share link</Trans>
          </div>
          <div className="mt-4 truncate rounded-4 bg-slate-700 px-12 py-10 font-mono text-12">
            {getReferralCodeTradeUrl(code)}
          </div>
        </>
      )}

      <label className="mt-16 flex cursor-pointer items-start gap-8 text-12 text-slate-100">
        <input type="checkbox" className="mt-2" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          <Trans>I'm eligible, I'm not promoting to restricted jurisdictions, and I accept the partner terms.</Trans>
        </span>
      </label>

      <div className="mt-16 flex items-center gap-12">
        <Button
          variant="primary-action"
          disabled={!valid || !accepted || !canSubmit || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await registerReferralCode(chainId, code, signer, {
                sentMsg: t`Referral code submitted.`,
                failMsg: t`Referral code creation failed.`,
                successMsg: t`Referral code created.`,
                pendingTxns,
              });
              onCreated(code);
            } catch (error) {
              helperToast.error(t`Could not create the code.`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Trans>Creating…</Trans> : <Trans>Create code</Trans>}
        </Button>
        <span className="text-12 text-slate-100">
          <Trans>One transaction.</Trans>
        </span>
      </div>
    </StepCard>
  );
}

function DoneStep({ code }: { code: string }) {
  const [, copyToClipboard] = useCopyToClipboard();
  const link = getReferralCodeTradeUrl(code);

  return (
    <Card className="p-32 text-center">
      <div className="mx-auto flex size-48 items-center justify-center rounded-full bg-green-500 text-24 text-slate-900">
        ✓
      </div>
      <h1 className="mt-16 text-24 font-medium">
        <Trans>You're live. Share your link.</Trans>
      </h1>
      <p className="mx-auto mt-8 max-w-[44ch] text-13 text-slate-100">
        <Trans>
          You earn a share of the trading fee on every trade your clients make, claimable anytime. Your live rate is on
          the portal — it comes from the contract, not from this page.
        </Trans>
      </p>

      <div className="mt-20 flex items-center gap-8 rounded-4 bg-slate-700 p-12 text-left">
        <span className="truncate font-mono text-12">{link}</span>
        <div className="ml-auto shrink-0">
          <Button
            variant="primary-action"
            onClick={() => {
              copyToClipboard(link);
              helperToast.success(t`Share link copied.`);
            }}
          >
            <Trans>Copy link</Trans>
          </Button>
        </div>
      </div>

      <div className="mt-20 flex justify-center gap-12">
        <Link to="/partnerships">
          <Button variant="primary-action">
            <Trans>Go to your portal</Trans>
          </Button>
        </Link>
        <Link to="/partnerships/codes">
          <Button variant="secondary">
            <Trans>Add another code</Trans>
          </Button>
        </Link>
      </div>
    </Card>
  );
}
