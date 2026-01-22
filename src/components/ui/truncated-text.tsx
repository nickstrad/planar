"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type TruncatedTextProps = {
  text: string;
  maxWidth?: string;
  className?: string;
};

export const TruncatedText = ({
  text,
  maxWidth = "200px",
  className = "",
}: TruncatedTextProps) => {
  if (!text) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`truncate block cursor-help ${className}`}
          style={{ maxWidth }}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-md whitespace-pre-wrap">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};
