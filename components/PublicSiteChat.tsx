import { SupportChat } from "./SupportChat";

type Props = {
  siteSlug: string;
  brandName: string;
  brandTagline: string;
};

export function PublicSiteChat({ siteSlug, brandName, brandTagline }: Props) {
  return (
    <SupportChat
      brandName={brandName}
      brandTagline={brandTagline}
      siteSlug={siteSlug}
    />
  );
}
