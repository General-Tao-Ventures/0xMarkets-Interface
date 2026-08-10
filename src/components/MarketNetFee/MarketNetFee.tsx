import "./MarketNetFee.scss";
import { Trans, t } from "@lingui/macro";

import { dustClampChartRate } from "domain/synthetics/fees/chartRates";
import { formatRatePercentage } from "lib/numbers";
import { getPositiveOrNegativeClass } from "lib/utils";

type Props = {
  fundingRateHourly: bigint;
  borrowRateHourly: bigint;
  isLong: boolean;
};

const RATE_PERIODS = [
  {
    hours: 8,
    label: "8h",
    decimals: 3,
  },
  {
    hours: 24,
    label: "24h",
    decimals: 3,
  },
  {
    hours: 8760,
    label: "365d",
    decimals: 2,
  },
];

export default function MarketNetFee(props: Props) {
  const { isLong } = props;
  // Align prose / period rows with chart-header dust clamp (±0.0000% → 0).
  const fundingRateHourly = dustClampChartRate(props.fundingRateHourly);
  const borrowRateHourly = dustClampChartRate(props.borrowRateHourly);
  const netFeeHourly = borrowRateHourly + fundingRateHourly;
  const positionType = isLong ? t`Long Positions` : t`Short Positions`;
  const netRate = t`Net Rate`;

  return (
    <>
      <div className="mb-5 text-typography-secondary">
        {positionType} {netRate}:
      </div>
      <ul className="net-fees-over-time">
        {RATE_PERIODS.map((period) => {
          const netFee = netFeeHourly * BigInt(period.hours);
          return (
            <li key={period.label}>
              <span className="net-fee__period">{period.label}:</span>
              <span className={getPositiveOrNegativeClass(netFee)}>
                {formatRatePercentage(netFee, {
                  displayDecimals: period.decimals,
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-5">
        <NetFeeMessage fundingRateHourly={fundingRateHourly} borrowRateHourly={borrowRateHourly} isLong={isLong} />
      </div>
    </>
  );
}

function renderRateMagnitude(rate: bigint) {
  // Show unsigned magnitude in prose ("pay 0.01%" not "pay -0.01%").
  const magnitude = rate < 0n ? -rate : rate;
  return <span className={getPositiveOrNegativeClass(rate)}>{formatRatePercentage(magnitude)}</span>;
}

function NetFeeMessage(props: Props) {
  const { fundingRateHourly, borrowRateHourly, isLong } = props;
  const fundingAction = fundingRateHourly >= 0 ? t`receive` : t`pay`;
  const longOrShort = isLong ? t`Long` : t`Short`;
  const isFundingRateZero = fundingRateHourly === 0n;
  const isBorrowRateZero = borrowRateHourly === 0n;
  const fundingRate = renderRateMagnitude(fundingRateHourly);
  const borrowRate = renderRateMagnitude(borrowRateHourly);

  if (isFundingRateZero && isBorrowRateZero) {
    return <Trans>{longOrShort} positions do not pay a funding fee or a borrow fee.</Trans>;
  } else if (isFundingRateZero) {
    return (
      <Trans>
        {longOrShort} positions do not pay a funding fee and pay a borrow fee of {borrowRate} per hour.
      </Trans>
    );
  } else if (isBorrowRateZero) {
    return (
      <Trans>
        {longOrShort} positions {fundingAction} a funding fee of {fundingRate} per hour and do not pay a borrow fee.
      </Trans>
    );
  } else {
    return (
      <Trans>
        {longOrShort} positions {fundingAction} a funding fee of {fundingRate} per hour and pay a borrow fee of{" "}
        {borrowRate} per hour.
      </Trans>
    );
  }
}
