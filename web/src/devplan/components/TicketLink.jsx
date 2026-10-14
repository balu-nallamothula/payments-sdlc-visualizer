import { JIRA_BROWSE } from "../config.js";

// External link to a Jira ticket — the single owner of the browse-URL + link
// contract (target/rel). Defaults to the `card-key` style and shows the key as
// its label; pass `className`/`children` to vary either, and any extra props
// (onClick, tooltip bindings) flow straight through to the anchor.
export default function TicketLink({ keyText, className = "card-key", children, ...rest }) {
  return (
    <a className={className} href={`${JIRA_BROWSE}/${keyText}`} target="_blank" rel="noopener noreferrer" {...rest}>
      {children ?? keyText}
    </a>
  );
}
