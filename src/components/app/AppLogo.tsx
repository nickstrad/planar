import { APP_NAME } from "@/lib/constants";
import Image, { ImageProps } from "next/image";

export const AppLogo = ({
  width = 40,
  height = 40,
  ...rest
}: Partial<ImageProps>) => (
  <Image
    src="/globe.svg"
    alt={`${APP_NAME} Logo`}
    width={width}
    height={height}
    {...rest}
  />
);
