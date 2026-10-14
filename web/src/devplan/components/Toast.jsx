export default function Toast({ toast }) {
  return (
    <div className={"toast" + (toast ? " show" : "") + (toast?.error ? " error" : "")} role="status" aria-live="polite">
      {toast?.msg || ""}
    </div>
  );
}
