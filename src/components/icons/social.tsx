import * as React from "react";
import { cn } from "@/lib/utils";

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

const baseProps: React.SVGProps<SVGSVGElement> = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
};

export function InstagramIcon({ className, ...props }: IconProps) {
  return (
    <svg
      {...baseProps}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function WhatsappIcon({ className, ...props }: IconProps) {
  return (
    <svg
      {...baseProps}
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M19.05 4.91A10 10 0 0 0 4.94 19.06L4 22l3-.78A10 10 0 1 0 19.05 4.91Zm-7.06 15.32a8.34 8.34 0 0 1-4.24-1.16l-.3-.18-2.13.56.57-2.08-.2-.31a8.36 8.36 0 1 1 6.3 3.17ZM16.4 14.4c-.25-.13-1.49-.74-1.72-.83-.23-.08-.4-.13-.57.13-.17.25-.66.83-.81 1-.15.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.66-1.25-1.49-1.4-1.74-.15-.25-.02-.39.11-.51.12-.12.25-.3.37-.45.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.42-.43-.57-.44h-.49c-.17 0-.45.07-.68.31-.23.25-.9.88-.9 2.14 0 1.27.92 2.49 1.05 2.66.13.17 1.81 2.77 4.39 3.88.61.27 1.09.43 1.46.55.61.2 1.17.17 1.62.1.49-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.17-.48-.3Z"
      />
    </svg>
  );
}

export function TalabatIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} className={cn("h-5 w-5", className)} {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fontSize="6"
        fontFamily="serif"
        fontWeight="500"
        fill="currentColor"
      >
        T
      </text>
    </svg>
  );
}

export function DeliverooIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} className={cn("h-5 w-5", className)} {...props}>
      <path
        d="M5 7l2 12h10L19 7M9 11h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function CareemIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} className={cn("h-5 w-5", className)} {...props}>
      <path
        d="M3 16h2l1.5-3 4-7 4 7 1.5 3h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function NoonIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} className={cn("h-5 w-5", className)} {...props}>
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="9"
        fontFamily="serif"
        fontStyle="italic"
        fill="currentColor"
      >
        n
      </text>
    </svg>
  );
}

export function TiktokIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} className={cn("h-5 w-5", className)} {...props}>
      <path
        d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M14 4c0 2.5 2 4.5 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function getSocialIcon(platform: string) {
  switch (platform.toLowerCase()) {
    case "instagram":
      return InstagramIcon;
    case "whatsapp":
      return WhatsappIcon;
    case "talabat":
      return TalabatIcon;
    case "deliveroo":
      return DeliverooIcon;
    case "careem":
      return CareemIcon;
    case "noon":
      return NoonIcon;
    case "tiktok":
      return TiktokIcon;
    default:
      return null;
  }
}
