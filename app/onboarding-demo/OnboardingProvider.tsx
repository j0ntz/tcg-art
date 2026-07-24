"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { HireRecord, TaskStatus, WorkdayAdapter } from "@/lib/workday";

// Session state for the onboarding demo. The server layout seeds this from the
// Workday adapter's RaaS read; from there, status transitions the user makes
// live here in memory and persist across client navigation between the
// dashboard and hire detail (the provider sits above both in the route group
// layout). This mirrors what a real integration would do on the WRITE path:
// adapter.updateOnboardingTaskStatus(taskId, status). In-memory is deliberate
// for a demo (the issue calls it out); nothing is written back to any tenant.

interface OnboardingContextValue {
  records: HireRecord[];
  mode: WorkdayAdapter["mode"];
  getHire: (workerId: string) => HireRecord | undefined;
  setTaskStatus: (workerId: string, taskId: string, status: TaskStatus) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  initialRecords: HireRecord[];
  mode: WorkdayAdapter["mode"];
  children: React.ReactNode;
}

const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  initialRecords,
  mode,
  children,
}) => {
  const [records, setRecords] = useState<HireRecord[]>(initialRecords);

  const setTaskStatus = useCallback(
    (workerId: string, taskId: string, status: TaskStatus) => {
      setRecords((current) =>
        current.map((record) => {
          if (record.worker.workerId !== workerId) return record;
          return {
            ...record,
            tasks: record.tasks.map((task) =>
              task.taskId === taskId ? { ...task, status } : task,
            ),
          };
        }),
      );
    },
    [],
  );

  const byId = useMemo(
    () => new Map(records.map((record) => [record.worker.workerId, record])),
    [records],
  );

  const getHire = useCallback((workerId: string) => byId.get(workerId), [byId]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ records, mode, getHire, setTaskStatus }),
    [records, mode, getHire, setTaskStatus],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export default OnboardingProvider;

export const useOnboarding = (): OnboardingContextValue => {
  const context = useContext(OnboardingContext);
  if (context == null) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
