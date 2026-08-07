import React from "react";

type LinkChildProps = {
  to?: string | { pathname?: string };
  href?: string;
  newTab?: boolean;
  target?: string;
  onClick?: (e: React.MouseEvent) => void;
};

interface TrackingLinkProps {
  onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLDivElement, MouseEvent>) => Promise<void> | void;
  children: React.ReactElement<LinkChildProps>;
}

function resolveUrl(props: LinkChildProps): string | undefined {
  if (typeof props.href === "string" && props.href) {
    return props.href;
  }
  if (props.to !== undefined) {
    return typeof props.to === "string" ? props.to : props.to.pathname || "/";
  }
  return undefined;
}

function shouldOpenInNewTab(props: LinkChildProps): boolean {
  return Boolean(props.newTab) || props.target === "_blank";
}

export function TrackingLink({ onClick, children }: TrackingLinkProps) {
  if (!children) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement | HTMLDivElement, MouseEvent>) => {
    if (onClick) {
      e.preventDefault();

      try {
        await onClick(e);
      } catch {
        // ignore
      }

      const url = resolveUrl(children.props);
      if (!url) return;

      if (shouldOpenInNewTab(children.props)) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = url;
      }
    } else if (children.props.onClick) {
      children.props.onClick(e);
    }
  };

  return React.cloneElement(children, {
    ...children.props,
    onClick: handleClick,
  });
}
