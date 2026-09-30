import { useCallback } from "react";
import { downloadJson, todayStamp, readJsonFile } from "../download.js";
import { buildBoardExport } from "../exports.js";

// Board & history file IO: the export + import handlers with their validation and
// confirm-before-replace prompts. Kept out of App so the root stays composition.
// Called after the board model is built (it reads post-model state).
export function useBoardIO({ jira, plan, board, history, snapshots, allIssues, filters, showToast, setSetupOpen, setActivePage }) {
  const onExportBoard = useCallback(() => {
    downloadJson(`dev-plan-board-${todayStamp()}.json`, buildBoardExport({
      epics: jira.epics, allIssues, overrides: plan.overrides, filters, board,
      exportedAt: new Date().toISOString(),
    }));
    showToast("Board exported to JSON");
  }, [jira.epics, allIssues, plan.overrides, filters, board, showToast]);

  const onImportBoard = useCallback(async (file) => {
    try {
      const data = await readJsonFile(file);
      if (data?.kind !== "dev-plan-board" || !data.state?.epics) {
        showToast("That isn't a Dev Plan board export", true);
        return;
      }
      if (jira.hasData && !window.confirm("Replace the current board and local moves with this file? Your history and snapshots stay untouched.")) return;
      jira.importBoard(data.state.epics);
      plan.replaceOverrides(data.state.overrides || {});
      setSetupOpen(false);
      setActivePage("board");
      showToast("Board imported (replaced current)");
    } catch (e) {
      showToast(e.message || "Import failed", true);
    }
  }, [jira.hasData, jira.importBoard, plan.replaceOverrides, showToast, setSetupOpen, setActivePage]);

  const onImportHistory = useCallback(async (file) => {
    try {
      const data = await readJsonFile(file);
      if (data?.kind !== "dev-plan-history") {
        showToast("That isn't a Dev Plan history export", true);
        return;
      }
      if ((history.history.length || snapshots.snapshots.length) &&
          !window.confirm("Replace the current history and closed-sprint snapshots with this file?")) return;
      history.replaceHistory(data.syncEvents || []);
      snapshots.replaceSnapshots(data.closedSprintSnapshots || []);
      showToast("History imported (replaced current)");
    } catch (e) {
      showToast(e.message || "Import failed", true);
    }
  }, [history.history.length, history.replaceHistory, snapshots.snapshots.length, snapshots.replaceSnapshots, showToast]);

  return { onExportBoard, onImportBoard, onImportHistory };
}
