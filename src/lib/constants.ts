export const APP_NAME = "Planar";

export const ERRORS = {
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "You do not have permission to access this resource.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "unauthorized",
  },
} as const;

export const ENTITIES = {
  ENTITY: "entity",
} as const;

export const STATIC_PATHS = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 5,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;
