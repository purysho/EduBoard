// Shared keyboard-navigation helper for gradebook cells — both the plain-points
// ScoreCell (an <input>) and the rubric-graded RubricScoreCell (a <button>) mark
// themselves with data-row/data-col so Enter/Arrow keys can jump between cells
// regardless of which cell type is at the destination.
export function focusGradebookCell(row: number, col: number): void {
  const target = document.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)
  if (!target) return
  target.focus()
  if (target instanceof HTMLInputElement) target.select()
}
