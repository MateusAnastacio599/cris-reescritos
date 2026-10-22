export function installMobileBoardUX(documentRef = document) {
  const view = documentRef.getElementById("view");
  if (!view || view.dataset.crisMobileBoardUX === "ready") return;
  view.dataset.crisMobileBoardUX = "ready";
  let previous = null;

  function placeCaretAtEnd(note) {
    const selection = documentRef.getSelection?.();
    if (!selection || !documentRef.createRange) return;
    try {
      const range = documentRef.createRange();
      range.selectNodeContents(note);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Some mobile browsers may not expose a selection until focus completes.
    }
  }

  documentRef.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const active = documentRef.activeElement;
    if (active?.matches?.('.note[contenteditable="true"]') && !active.contains(target)) active.blur();

    const note = target?.closest?.("#items .it .note");
    const touch = event.pointerType === "touch" || window.matchMedia?.("(pointer: coarse)").matches;
    if (!note || !touch || !documentRef.body.classList.contains("tool-select") || note.isContentEditable) {
      previous = null;
      return;
    }

    const id = note.closest(".it")?.dataset.id;
    const now = Date.now();
    const second = id && previous?.id === id && now - previous.time <= 900 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 36;
    if (!second) {
      previous = { id, time: now, x: event.clientX, y: event.clientY };
      return;
    }

    previous = null;
    note.contentEditable = "true";
    note.setAttribute("aria-label", "Editando post-it. Toque fora ou pressione Esc para concluir.");
    note.setAttribute("spellcheck", "true");
    try {
      note.focus({ preventScroll: true });
    } catch {
      note.focus();
    }
    placeCaretAtEnd(note);
  }, true);

  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && documentRef.activeElement?.matches?.('.note[contenteditable="true"]')) {
      event.preventDefault?.();
      documentRef.activeElement.blur();
    }
  }, true);
}
