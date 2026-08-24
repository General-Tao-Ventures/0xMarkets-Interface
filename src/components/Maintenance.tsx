const DISCORD_LINK = "https://discord.com/invite/zGkW2kTsGM";
export default function Maintenance() {
  return (
    <html lang="en" className="h-full w-full">
      <head>
        <title>Maintenance</title>
      </head>
      <body className="flex h-full w-full flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="0xMarkets" width={40} height={40} className="object-contain" />

        <p className="text-[14px]">
          0xMarkets is currently undergoing maintenance. Please see{" "}
          <a
            href={DISCORD_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Discord
          </a>{" "}
          for further updates.
        </p>
      </body>
    </html>
  );
}
