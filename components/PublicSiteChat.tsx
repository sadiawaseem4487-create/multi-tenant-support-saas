import { SupportChat, type SupportChatConfig } from "./SupportChat";

type Props = {
  siteSlug: string;
  brandName: string;
  brandTagline: string;
  chatConfig?: SupportChatConfig;
};

export function PublicSiteChat({
  siteSlug,
  brandName,
  brandTagline,
  chatConfig,
}: Props) {
  return (
    <SupportChat
      brandName={brandName}
      brandTagline={brandTagline}
      siteSlug={siteSlug}
      chatConfig={chatConfig}
    />
  );
}
