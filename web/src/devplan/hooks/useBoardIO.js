import { useCallback } from "react";
import { downloadJson, todayStamp, readJsonFile } from "../download.js";
import { buildBoardExport } from "../exports.js";
import { useConfirm } from "../../context/ConfirmContext.jsx";

// Board & history file IO: the export handler plus the history import, with its
// validation and confirm-before-replace prompt. Kept out of App so the root stays
// composition. Called after the board model is built (it reads post-model state).
// Board import lives in Settings now (writes the board snapshot directly).
export function useBoardIO({ jira, plan, board, history, snapshots, allIssues, filters, showToast }) {
  const confirm = useConfirm();
  const onExportBoard = useCallback(() => {
    downloadJson(`dev-plan-board-${todayStamp()}.json`, buildBoardExport({
      epics: jira.epics, allIssues, overrides: plan.overrides, filters, board,
      exportedAt: new Date().toISOString(),
    }));
    showToast("Board exported to JSON");
  }, [jira.epics, allIssues, plan.overrides, filters, board, showToast]);

  const onImportHistory = useCallback(async (file) => {
    try {
      const data = await readJsonFile(file);
      if (data?.kind !== "dev-plan-history") {
        showToast("That isn't a Dev Plan history export", true);
        return;
      }
      if ((history.history.length || snapshots.snapshots.length) &&
          !(await confirm({
            title: "Replace history?",
            message: "Replace the current history and closed-sprint snapshots with this file?",
            confirmLabel: "Replace",
            danger: true,
          }))) return;
      history.replaceHistory(data.syncEvents || []);
      snapshots.replaceSnapshots(data.closedSprintSnapshots || []);
      showToast("History imported (replaced current)");
    } catch (e) {
      showToast(e.message || "Import failed", true);
    }
  }, [history.history.length, history.replaceHistory, snapshots.snapshots.length, snapshots.replaceSnapshots, showToast, confirm]);

  return { onExportBoard, onImportHistory };
}
