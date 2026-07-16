import { describe, expect, it } from "vitest";

import { validateArtifactFile } from "./api";

describe("validateArtifactFile", () => {
  it("keeps the PDF/DOCX/TXT, non-empty, 25 MiB validation contract", () => {
    expect(validateArtifactFile(new File(["notes"], "notes.txt", { type: "text/plain" }))).toBeNull();
    expect(validateArtifactFile(new File([""], "empty.txt", { type: "text/plain" }))).toContain("empty");
    expect(validateArtifactFile(new File(["notes"], "notes.png", { type: "image/png" }))).toContain("PDF, DOCX, and TXT");
    expect(
      validateArtifactFile(
        new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }),
      ),
    ).toContain("25 MiB");
  });
});
