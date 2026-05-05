import {
  SiGoogle,
  SiGithub,
  SiApple,
  SiDiscord,
  SiFacebook,
  SiGitlab,
  SiSlack,
  SiX,
} from "react-icons/si";
import { FaMicrosoft, FaLinkedinIn } from "react-icons/fa";
import { Shield } from "lucide-react";
import type { ComponentType } from "react";

const PROVIDER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  google: SiGoogle,
  github: SiGithub,
  "microsoft-entra-id": FaMicrosoft,
  apple: SiApple,
  discord: SiDiscord,
  facebook: SiFacebook,
  linkedin: FaLinkedinIn,
  gitlab: SiGitlab,
  slack: SiSlack,
  twitter: SiX,
};

interface ProviderIconProps {
  providerKey: string;
  className?: string;
}

export function ProviderIcon({ providerKey, className = "w-4 h-4" }: ProviderIconProps) {
  const Icon = PROVIDER_ICONS[providerKey] ?? Shield;
  return <Icon className={className} />;
}
