// app/open-note.js — открытие заметки (Ctrl/Cmd — в новой вкладке).
module.exports = function createOpenNote(app) {
  return (path, evt) => app.workspace.openLinkText(path, "", !!(evt && (evt.ctrlKey || evt.metaKey || evt.button === 1)));
};
