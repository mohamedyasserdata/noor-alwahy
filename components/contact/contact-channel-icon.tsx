import {
  AtSign,
  Camera,
  Link2,
  Mail,
  MessageCircleMore,
  Music2,
  PhoneCall,
  Send,
  UsersRound,
  Video,
} from "lucide-react";

type ContactChannelIconProps = {
  type: string;
};

export function ContactChannelIcon({ type }: ContactChannelIconProps) {
  if (type === "whatsapp") return <MessageCircleMore aria-hidden="true" />;
  if (type === "phone") return <PhoneCall aria-hidden="true" />;
  if (type === "email") return <Mail aria-hidden="true" />;
  if (type === "facebook") return <UsersRound aria-hidden="true" />;
  if (type === "instagram") return <Camera aria-hidden="true" />;
  if (type === "telegram") return <Send aria-hidden="true" />;
  if (type === "youtube") return <Video aria-hidden="true" />;
  if (type === "tiktok") return <Music2 aria-hidden="true" />;
  if (type === "other") return <Link2 aria-hidden="true" />;
  return <AtSign aria-hidden="true" />;
}
