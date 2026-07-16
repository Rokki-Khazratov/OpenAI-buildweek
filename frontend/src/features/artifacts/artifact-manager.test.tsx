import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArtifactManager } from "./artifact-manager";
import {
  deleteArtifact,
  getArtifactSummary,
  listArtifacts,
  retryArtifact,
  uploadArtifact,
  validateArtifactFile,
} from "./api";
import type { Artifact } from "./types";

vi.mock("./api", () => ({
  deleteArtifact: vi.fn(),
  downloadArtifact: vi.fn(),
  getArtifactSummary: vi.fn(),
  listArtifacts: vi.fn(),
  retryArtifact: vi.fn(),
  uploadArtifact: vi.fn(),
  validateArtifactFile: vi.fn(() => null),
}));

const listArtifactsMock = vi.mocked(listArtifacts);
const uploadArtifactMock = vi.mocked(uploadArtifact);
const retryArtifactMock = vi.mocked(retryArtifact);
const deleteArtifactMock = vi.mocked(deleteArtifact);
const getArtifactSummaryMock = vi.mocked(getArtifactSummary);

function artifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "artifact-1",
    exam_id: "exam-1",
    kind: "notes",
    original_name: "notes.txt",
    declared_media_type: "text/plain",
    detected_media_type: "text/plain",
    size_bytes: 120,
    upload_status: "uploaded",
    processing_status: "ready",
    failure_code: null,
    failure_message: null,
    parser_version: "v1",
    page_count: 1,
    character_count: 120,
    uploaded_at: "2026-07-16T10:00:00Z",
    processed_at: "2026-07-16T10:00:01Z",
    created_at: "2026-07-16T10:00:00Z",
    updated_at: "2026-07-16T10:00:01Z",
    ...overrides,
  };
}

async function loadInitialItems() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.mocked(validateArtifactFile).mockReturnValue(null);
  listArtifactsMock.mockResolvedValue({ items: [], total: 0 });
  getArtifactSummaryMock.mockResolvedValue({ page_count: 1, character_count: 120, chunk_count: 1, preview: "Preview" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ArtifactManager", () => {
  it("retains the 20-file cap and reports validation errors before uploading", async () => {
    render(<ArtifactManager examId="exam-1" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = Array.from({ length: 21 }, (_, index) => new File(["x"], `${index}.txt`));

    fireEvent.change(input, { target: { files } });

    expect(screen.getByRole("alert")).toHaveTextContent("at most 20 files");
    expect(uploadArtifactMock).not.toHaveBeenCalled();
  });

  it("names each partial-upload failure while keeping successful files listed", async () => {
    const successful = artifact();
    listArtifactsMock.mockResolvedValue({ items: [successful], total: 1 });
    uploadArtifactMock
      .mockResolvedValueOnce(successful)
      .mockRejectedValueOnce(new Error("The file could not reach storage."));
    render(<ArtifactManager examId="exam-1" />);
    await loadInitialItems();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(["ok"], "good.txt"), new File(["bad"], "bad.txt")] },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("bad.txt: The file could not reach storage.");
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
  });

  it("polls queued files to a terminal state and refreshes the selected summary", async () => {
    const queued = artifact({ processing_status: "queued", updated_at: "2026-07-16T10:00:00Z" });
    const ready = artifact({ processing_status: "ready", updated_at: "2026-07-16T10:00:03Z" });
    const onMutation = vi.fn();
    listArtifactsMock
      .mockResolvedValueOnce({ items: [queued], total: 1 })
      .mockResolvedValueOnce({ items: [ready], total: 1 });
    getArtifactSummaryMock.mockResolvedValue({ page_count: 1, character_count: 120, chunk_count: 2, preview: "Extracted text" });
    render(<ArtifactManager examId="exam-1" onMutation={onMutation} />);
    await loadInitialItems();

    fireEvent.click(screen.getByRole("button", { name: "Details for notes.txt" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("Extracted text", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(onMutation).toHaveBeenCalledTimes(1);
  });

  it("closes a selected panel when polling no longer returns its artifact", async () => {
    const selected = artifact();
    const otherQueued = artifact({ id: "artifact-2", original_name: "still-processing.txt", processing_status: "queued" });
    listArtifactsMock
      .mockResolvedValueOnce({ items: [selected, otherQueued], total: 2 })
      .mockResolvedValueOnce({ items: [otherQueued], total: 1 });
    render(<ArtifactManager examId="exam-1" />);
    await loadInitialItems();

    fireEvent.click(screen.getByRole("button", { name: "Details for notes.txt" }));
    expect(screen.getByRole("region", { name: "Artifact details" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.queryByRole("region", { name: "Artifact details" })).not.toBeInTheDocument();
  });

  it("guards retry and confirmed delete against duplicate in-flight requests", async () => {
    const failed = artifact({ processing_status: "failed", failure_message: "Parser failed" });
    const onMutation = vi.fn();
    listArtifactsMock.mockResolvedValue({ items: [failed], total: 1 });
    let resolveRetry: ((value: Artifact) => void) | undefined;
    let resolveDelete: (() => void) | undefined;
    retryArtifactMock.mockReturnValue(new Promise<Artifact>((resolve) => { resolveRetry = resolve; }));
    deleteArtifactMock.mockReturnValue(new Promise<void>((resolve) => { resolveDelete = resolve; }));
    render(<ArtifactManager examId="exam-1" onMutation={onMutation} />);
    await loadInitialItems();

    const retry = screen.getByRole("button", { name: "Retry notes.txt" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(retryArtifactMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRetry?.(failed);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete notes.txt" }));
    const confirm = screen.getByRole("button", { name: "Delete file" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(deleteArtifactMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDelete?.();
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onMutation).toHaveBeenCalledTimes(2);
  });
});
