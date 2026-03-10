import { init, track } from "@plausible-analytics/tracker";

init({
  domain: "app.0xmarkets.io",
  hashBasedRouting: true,
});

export function trackEvent(event: string, props?: Record<string, string | number | boolean>) {
  const stringProps = props
    ? Object.fromEntries(Object.entries(props).map(([k, v]) => [k, String(v)]))
    : undefined;
  track(event, { props: stringProps });
}
