"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ExportEntityType } from "@auction/exports";
import {
  cancelExportJob,
  createExport,
  fetchExportJob,
  listExportJobs,
  triggerExportDownload,
  downloadBlob,
} from "@/lib/exports/export-api";
import type { CreateExportRequest, ExportJobView } from "@/lib/exports/types";
import { notify } from "@/lib/ui/notify";
import { exportErrorMessage } from "@/lib/ui/export-error-message";

type ExportJobsContextValue = {
  jobs: ExportJobView[];
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
  activeCount: number;
  startExport: (req: CreateExportRequest) => Promise<void>;
  refreshJobs: () => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  downloadJob: (job: ExportJobView) => void;
};

const ExportJobsContext = createContext<ExportJobsContextValue | null>(null);

export function useExportJobs(): ExportJobsContextValue {
  const ctx = useContext(ExportJobsContext);
  if (!ctx) throw new Error("useExportJobs requires ExportJobsProvider");
  return ctx;
}

function isJobDownloadable(job: ExportJobView): boolean {
  if (job.status !== "completed" || !job.expiresAt) return false;
  return new Date(job.expiresAt).getTime() > Date.now();
}

type Props = { children: ReactNode };

export function ExportJobsProvider({ children }: Props) {
  const [jobs, setJobs] = useState<ExportJobView[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const pollRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const refreshJobs = useCallback(async () => {
    try {
      const data = await listExportJobs();
      setJobs(data);
    } catch {
      /* ignore background refresh errors */
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const stopPolling = useCallback((id: string) => {
    const handle = pollRef.current.get(id);
    if (handle) {
      clearInterval(handle);
      pollRef.current.delete(id);
    }
  }, []);

  const pollJob = useCallback(
    (id: string) => {
      if (pollRef.current.has(id)) return;
      const handle = setInterval(async () => {
        try {
          const job = await fetchExportJob(id);
          setJobs((prev) => {
            const next = prev.filter((j) => j.id !== id);
            return [job, ...next];
          });
          if (job.status === "completed") {
            stopPolling(id);
            if (isJobDownloadable(job)) {
              notify.action("Export ready", {
                id: `export-${id}`,
                ...(job.filename ? { description: job.filename } : {}),
                actionLabel: "Download",
                onAction: () => triggerExportDownload(id),
              });
              if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                triggerExportDownload(id);
              }
            } else {
              notify.success("Export completed", {
                description: job.filename ?? "Your export finished.",
              });
            }
          }
          if (job.status === "failed" || job.status === "cancelled") {
            stopPolling(id);
          }
        } catch {
          stopPolling(id);
        }
      }, 2000);
      pollRef.current.set(id, handle);
    },
    [stopPolling],
  );

  const downloadJob = useCallback((job: ExportJobView) => {
    triggerExportDownload(job.id);
  }, []);

  const cancelJob = useCallback(
    async (id: string) => {
      const job = await cancelExportJob(id);
      stopPolling(id);
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
    },
    [stopPolling],
  );

  const startExport = useCallback(
    async (req: CreateExportRequest, options?: { isRetry?: boolean }) => {
      const toastId = `export-start-${req.entityType}`;
      notify.loading("Preparing export…", { id: toastId });
      try {
        const result = await createExport(req);
        notify.dismiss(toastId);

        if (result.mode === "sync") {
          downloadBlob(result.blob, result.filename);
          notify.success("Download started", {
            description: result.filename,
          });
          return;
        }

        if (result.mode === "existing") {
          if (isJobDownloadable(result.job)) {
            triggerExportDownload(result.job.id);
            notify.success("Download started", {
              description: result.job.filename ?? "Using your recent export",
            });
            return;
          }
          if (result.job.status === "pending" || result.job.status === "processing") {
            setJobs((prev) => [result.job, ...prev.filter((j) => j.id !== result.job.id)]);
            setTrayOpen(true);
            pollJob(result.job.id);
            notify.info("Export already running", {
              id: `export-existing-${result.job.id}`,
              description: result.job.filterSummary ?? "Showing progress in exports tray",
            });
            return;
          }
          if (!options?.isRetry) {
            notify.info("Previous export unavailable", {
              id: `export-retry-${req.entityType}`,
              description: "Starting a fresh export",
            });
            return startExport(req, { isRetry: true });
          }
          notify.error("Export unavailable", {
            description: "Could not reuse or start a new export",
          });
          return;
        }

        setJobs((prev) => [result.job, ...prev.filter((j) => j.id !== result.job.id)]);
        setTrayOpen(true);
        pollJob(result.job.id);

        if (result.mode === "async") {
          notify.info("Export queued", {
            id: `export-queued-${result.job.id}`,
            description: result.job.filterSummary ?? "Running in background",
          });
        }
      } catch (err) {
        notify.dismiss(toastId);
        notify.error("Export failed", { description: exportErrorMessage(err) });
        throw err;
      }
    },
    [pollJob],
  );

  useEffect(() => {
    return () => {
      for (const handle of pollRef.current.values()) clearInterval(handle);
      pollRef.current.clear();
    };
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((j) => j.status === "pending" || j.status === "processing").length,
    [jobs],
  );

  const value = useMemo(
    () => ({
      jobs,
      trayOpen,
      setTrayOpen,
      activeCount,
      startExport,
      refreshJobs,
      cancelJob,
      downloadJob,
    }),
    [jobs, trayOpen, activeCount, startExport, refreshJobs, cancelJob, downloadJob],
  );

  return <ExportJobsContext.Provider value={value}>{children}</ExportJobsContext.Provider>;
}

export type { ExportEntityType };
