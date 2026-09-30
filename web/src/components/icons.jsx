// Minimal inline stroke icons (24x24, currentColor). Keeps us dependency-free.

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const mk = (paths) => (props) => (
  <svg {...base} {...props}>
    {paths}
  </svg>
);

export const IconDashboard = mk(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);
export const IconLayers = mk(
  <>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </>,
);
export const IconStages = mk(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M6 8.5V12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8.5" />
    <path d="M12 14v1.5" />
  </>,
);
export const IconReports = mk(
  <>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </>,
);
export const IconHealth = mk(
  <path d="M3 12h4l2 5 4-12 2 7h6" />,
);
export const IconDoc = mk(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </>,
);
export const IconFolder = mk(
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
);
export const IconPlug = mk(
  <>
    <path d="M9 2v6M15 2v6" />
    <path d="M7 8h10v3a5 5 0 0 1-10 0Z" />
    <path d="M12 16v6" />
  </>,
);
export const IconChat = mk(
  <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />,
);
export const IconSearch = mk(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);
export const IconSun = mk(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const IconMoon = mk(
  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
);
export const IconBell = mk(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>,
);
export const IconStar = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21.9l1.1-6.5L2.6 9.8l6.5-.9L12 3Z" />
  </svg>
);
export const IconArrowLeft = mk(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const IconArrowRight = mk(<path d="M5 12h14M12 5l7 7-7 7" />);
export const IconChevronLeft = mk(<path d="m15 18-6-6 6-6" />);
export const IconCalendar = mk(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);
export const IconTarget = mk(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" />
  </>,
);
export const IconRocket = mk(
  <>
    <path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3-.2Z" />
    <path d="M9 11a12 12 0 0 1 8-8c1 0 2 1 2 2a12 12 0 0 1-8 8" />
    <path d="M9 11 7 9M13 15l2 2" />
  </>,
);
export const IconCheck = (props) => (
  <svg {...base} strokeWidth={3} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const IconPlay = mk(<path d="M7 4.5v15l12-7.5-12-7.5Z" />);
export const IconSend = mk(<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />);
export const IconStop = mk(<rect x="6" y="6" width="12" height="12" rx="1.5" />);
export const IconPower = mk(
  <>
    <path d="M12 2v10" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  </>,
);
export const IconSave = mk(
  <>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </>,
);
export const IconTerminal = mk(
  <>
    <path d="m4 17 6-5-6-5" />
    <path d="M12 19h8" />
  </>,
);
export const IconPencil = mk(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>,
);
export const IconCopy = mk(
  <>
    <rect x="9" y="9" width="11" height="11" rx="1" />
    <path d="M5 15V6a1.5 1.5 0 0 1 1.5-1.5H15" />
  </>,
);
export const IconGit = mk(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="9" r="2.5" />
    <path d="M6 8.5v7M18 11.5a6 6 0 0 1-6 6H8.5" />
  </>,
);
export const IconLive = mk(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0" />
  </>,
);
export const IconExpand = mk(
  <>
    <path d="M15 3h6v6M9 21H3v-6" />
    <path d="M21 3l-7 7M3 21l7-7" />
  </>,
);
export const IconCollapse = mk(
  <>
    <path d="M4 10h6V4M20 14h-6v6" />
    <path d="M10 10 3 3M14 14l7 7" />
  </>,
);
