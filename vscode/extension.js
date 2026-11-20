import * as vscode from "vscode";
import { editorDiagnostics, editorWatches, findBaselineDirectory } from "./lib/editor-diagnostics.js";

const collection = vscode.languages.createDiagnosticCollection("colorwarning");

/** Warn in the editor for the same color-vision pairs the check reports. */
export function activate(context) {
  const refresh = (document) => {
    if (document.uri.scheme !== "file" || !editorWatches(document.uri.fsPath)) {
      collection.delete(document.uri);
      return;
    }
    const found = editorDiagnostics(document.uri.fsPath, document.getText(), findBaselineDirectory(document.uri.fsPath));
    collection.set(
      document.uri,
      found.map((item) => toDiagnostic(document, item)),
    );
  };

  const refreshOpen = () => {
    for (const document of vscode.workspace.textDocuments) refresh(document);
  };

  const baselineWatcher = vscode.workspace.createFileSystemWatcher("**/colorwarning-baseline.json");
  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)),
    baselineWatcher,
    baselineWatcher.onDidChange(refreshOpen),
    baselineWatcher.onDidCreate(refreshOpen),
    baselineWatcher.onDidDelete(refreshOpen),
  );
  refreshOpen();
}

export function deactivate() {
  collection.dispose();
}

function toDiagnostic(document, item) {
  const diagnostic = new vscode.Diagnostic(rangeFor(document, item.line, item.word), item.message, vscode.DiagnosticSeverity.Warning);
  diagnostic.source = "colorwarning";
  return diagnostic;
}

function rangeFor(document, line, word) {
  const lineIndex = Math.max(0, line - 1);
  if (lineIndex >= document.lineCount) return new vscode.Range(0, 0, 0, 0);
  const text = document.lineAt(lineIndex).text;
  const start = word.length > 0 ? text.indexOf(word) : -1;
  if (start >= 0) return new vscode.Range(lineIndex, start, lineIndex, start + word.length);
  return new vscode.Range(lineIndex, 0, lineIndex, text.length);
}
