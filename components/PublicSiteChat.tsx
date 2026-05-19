import { SupportChat, type SupportChatConfig } from "./SupportChat";

type Props = {
  siteSlug: string;
  brandName: string;
  brandTagline: string;
  chatConfig?: SupportChatConfig;
  primaryColor?: string | null;
};

export function PublicSiteChat({
  siteSlug,
  brandName,
  brandTagline,
  chatConfig,
  primaryColor,
}: Props) {
  return (
    <SupportChat
      key={siteSlug}
      brandName={brandName}
      brandTagline={brandTagline}
      siteSlug={siteSlug}
      chatConfig={chatConfig}
      primaryColor={primaryColor}
    />
  );
}
